/**
 * See class
 * @module Client/ComponentConnectorReducable
 */

import ComponentConnectorInterface from "./ComponentConnectorInterface.mjs";
import { STATE_CHANGE } from "./Store.mjs";
import ViewComponent from "./UI/ViewComponent.mjs";
import StoreReducable, { FirstStore, ENFORCE_SINGLE_STORE } from "./StoreReducable.mjs";
import InvalidEntityException from "../Exceptions/InvalidEntityException.mjs";
import NotImplementedException from "../Exceptions/NotImplementedException.mjs";

/**
 *
 * @returns {StoreReducable}
 */
let findDefaultStore = function () {
    if (ENFORCE_SINGLE_STORE)
        return FirstStore;
    else
        throw new NotImplementedException("Store");
}

/**
 * Used for connecting component and store using reducers
 */
class ComponentConnectorReducable extends ComponentConnectorInterface {
    /**
     *
     * @param {ViewComponent} ComponentClass
     * @param {Store} [Store]
     * @implements ComponentConnectorInterface
     */
    constructor(
        ComponentClass,
        Store
    ) {
        if (!Store)
            Store = findDefaultStore();

        super(ComponentClass, Store);

        if (!Store instanceof StoreReducable)
            throw new InvalidEntityException("Store<->StoreReducable");

        let This = this,
            dispatch = Store.dispatch.bind(Store),
            mapStateToPropsLoc,
            mapDispatchToPropsLoc,
            mergePropsLoc,
            optionsLoc;

        class ViewComponentConnectedReducable extends ComponentClass {
            constructor(props) {
                super(props);

                let thisComponent = this;

                this.props.dispatch = Store.dispatch.bind(Store);

                this.updateProps = function (newState) {
                    let ownProps = thisComponent.props,
                        stateProps = mapStateToPropsLoc ? mapStateToPropsLoc(newState, ownProps) : null,
                        dispatchProps = mapDispatchToPropsLoc ? mapDispatchToPropsLoc(dispatch, ownProps) : null,
                        mergedProps;

                    if (mergePropsLoc)
                        mergedProps = mergePropsLoc(stateProps, dispatchProps, ownProps);
                    else
                        mergedProps = Object.assign(ownProps, stateProps, dispatchProps);

                    thisComponent.props = mergedProps;
                };

                let subscriber = function (newState) {
                    let ownProps = thisComponent.props;
                    thisComponent.updateProps(newState);
                    let newProps = thisComponent.props;

                    // Prevent updating the component if input & output props are the same

                    thisComponent.update();
                };

                thisComponent.componentWillUnmount(function () {
                    Store.unsubscribe(STATE_CHANGE, subscriber);
                });

                Store.subscribe(STATE_CHANGE, subscriber, null, thisComponent);

                // Update state for the first time manually
                this.updateProps(Store.getState());
                //this.update();
            }
        }


        /**
         *
         * @param {function} [mapStateToProps=function(){}]
         * @param {function} [mapDispatchToProps=function(){}]
         * @param {function} [mergeProps]
         * @param {object} [options]
         * @returns {Class<ViewComponentConnectedReducable>}
         */
        this.connect = function (
            mapStateToProps,
            mapDispatchToProps,
            mergeProps,
            options
        ) {
            mapStateToPropsLoc = mapStateToProps;
            mapDispatchToPropsLoc = mapDispatchToProps;
            mergePropsLoc = mergeProps;
            optionsLoc = options;

            return ViewComponentConnectedReducable;
        }

    }
}

export default ComponentConnectorReducable;
export {
    findDefaultStore
}