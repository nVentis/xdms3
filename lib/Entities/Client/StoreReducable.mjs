/**
 * @module Client/StoreReducable
 * See class
 */

import Store, {STATUS_ACTING, PatchedStoreUpdate, STATUS_MUTATING} from "./Store.mjs";
import InvalidTypeException from "../Exceptions/InvalidTypeException.mjs";
import UniquenessViolationException from "../Exceptions/UniquenessViolationException.mjs";

// Enforce single store per application (per default)
// WARNING: Depending Entities (e.g. ComponentConnectorReducable) will use FirstStore, per default
export const ENFORCE_SINGLE_STORE = true;

/**
 * For ENFORCE_SINGLE_STORE === true, this will hold the reference to the first store
 * @type {StoreReducable}
 */
let FirstStore = null;

/**
 * Dispatches an action and updates store & state, respectively
 * @param {object|function} actionFuncOrObject
 * @returns {boolean}
 */
let dispatch = function (actionFuncOrObject) {};

/**
 * Store with integrated support for state reducers
 * Use in conjunction with ComponentConnectorReducable
 */
class StoreReducable extends Store {
    /**
     * @typedef {StoreConstructorProps} StoreReducableConstructorProps
     * @property {function} reducer
     */

    /**
     *
     * @param {StoreReducableConstructorProps} props
     */
    constructor(props) {
        super(props);

        let reducer = props.reducer,
            This = this;

        /**
         *
         * @param {object|function} actionInput
         * @returns {boolean}
         */
        this.dispatch = function (actionInput) {
            let actionObject;

            This.status = STATUS_ACTING;

            // console.log(actionInput);

            if (typeof actionInput === "function") {
                // Execute function with dispatch as argument to allow further actions to be called sequently
                console.groupCollapsed(`ACTION_FUNC: ${actionInput.name ? actionInput.name : "#anonymous"}`);
                actionObject = actionInput(This.dispatch.bind(This), () => This.state);
            } else if (typeof actionInput === "object") {
                console.groupCollapsed(`ACTION: ${actionInput.type}`);
                actionObject = actionInput;
            } else
                throw new InvalidTypeException("dispatch[actionInput]");

            if (typeof actionObject === "object" &&
                actionObject.type) {
                // Use reducer to get new state

                This.status = STATUS_MUTATING;

                let curState = This.getState(),
                    newState = reducer(curState, actionObject),
                    newStateKeys = Object.keys(newState);

                // Apply new state bit by bit - Use PatchedStoreUpdate
                while (newStateKeys.length - 1) {
                    let cKey = newStateKeys.pop();
                    if (JSON.stringify(newState[cKey]) !== JSON.stringify(curState)) {
                        let updateValue = new PatchedStoreUpdate(newState[cKey]);
                        This.state[cKey] = updateValue;
                    }
                }

                // Only one item remaining -> apply change
                if (newStateKeys.length) {
                    let lastKey = newStateKeys.pop();
                    This.state[lastKey] = newState[lastKey];
                }
            }

            console.groupEnd();

            return true;
        }

        // Only if ENFORCE_SINGLE_STORE === true
        if (ENFORCE_SINGLE_STORE && !FirstStore) {
            FirstStore = This;
            //dispatch = This.dispatch.bind(This);
        }
    }
}

class PrefixedReducerManager {
    /**
     *
     * @param {Store} [someStore]
     */
    constructor(someStore) {
        /**
         *
         * @type {object<string, function>}
         */
        let Reducers = {};

        /**
         *
         * @param {Store} newStore
         * @returns {PrefixedReducerManager}
         */
        this.setStore = function (newStore) {
            someStore = newStore;
            return this;
        }

        /**
         * Registers a reducing function for all actions where type starts with Prefix
         * Also silently (i.e. without triggering an update) merges the initial state of the added reducer to the given state
         * @param {string} Prefix
         * @param {function} reducerFunc
         * @returns {PrefixedReducerManager}
         */
        this.Register = function (Prefix, reducerFunc) {
            if (!Reducers[Prefix])
                Reducers[Prefix] = reducerFunc;
            else
                throw new UniquenessViolationException("Prefix");

            let initialState = Reducers[Prefix](null);
            console.log(initialState);
            for (let initialStatePropertyName in initialState) {
                let patchedUpdate = new PatchedStoreUpdate(initialState[initialStatePropertyName]);

                someStore.state[initialStatePropertyName] = patchedUpdate;
            }

            return this;
        }

        this.getReducer = function () {
            return function (state, action) {
                /**
                 * @type {string}
                 */
                let Prefix = action.type.split("_")[0];

                if (!Reducers[Prefix]) {
                    console.warn(`Unknown action type <${action.type}>`);
                    return state;
                } else {
                    return Reducers[Prefix](state, action);
                }

                /*
                if (action.type.startsWith("NVOPT"))
                    return reducerNVOPT(state, action);
                else if (action.type.startsWith("NEARBS"))
                    return reducerNEARBS(state, action);
                 */
            }
        }

    }
}

export default StoreReducable;
export {
    FirstStore,
    PrefixedReducerManager
    //dispatch
}