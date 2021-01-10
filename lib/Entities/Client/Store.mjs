/**
 * See class
 * @module Client/Store
 */

import DataEndpointInterfaceRW from "../Communication/DataEndpointInterfaceRW.mjs";
import {EventNamespace} from "../Event/Namespace.mjs";
import InvalidTypeException from "../Exceptions/InvalidTypeException.mjs";
import NotImplementedException from "../Exceptions/NotImplementedException.mjs";

const reservedPropKeywords = ["state", "actions", "mutations"];

export const STATUS_IDLING = "idling";
export const STATUS_MUTATING = "mutating";
export const STATUS_ACTING = "acting";

export const STATE_CHANGE = "stateChange";

/**
 * Allows updating state without calling the proxy, i.e. without notifiying listeners
 * Required for handling state updates where multiple changes occur (value will still be applied)
 * The last store update may occur without a PatchedStoreUpdate to unlock the store again (--> STATUS_IDLING)
 */
class PatchedStoreUpdate {
    /**
     *
     * @param Value
     */
    constructor(Value) {
        this.Value = Value;
    }
}

class Store {
    /**
     * @typedef {object} StoreConstructorProps
     * @property {object<string,function>} [actions] -
     * @property {object<string,function>} [mutations] -
     * @property [state] Initial state values; the STATE_CHANGE event will be triggered automatically on change
     */

    /**
     * @param {StoreConstructorProps} props - Props used for initializing the store
     * @param {object} [options]
     * @param {EventNamespace} [options.evtNamespace]
     * @constructor
     */
    constructor(
        props,
        options = {}
    ) {
        let This = this;

        this.props = props;

        /**
         * @type {object<string,function>}
         */
        this.actions = {};

        /**
         *
         * @type {object<string,function>}
         */
        this.mutations = {};

        this.status = STATUS_IDLING;

        if (props.hasOwnProperty("actions"))
            this.actions = props.actions;

        if (props.hasOwnProperty("mutations"))
            this.mutations = props.mutations;

        this.state = new Proxy((props.hasOwnProperty("state") ? props.state : {}), {
            set: function (state, key, value) {
                if (value && value instanceof PatchedStoreUpdate) {
                    state[key] = value.Value;

                    console.log(`hidden state update: ${key} => ${value.Value}`);

                    if (This.status !== STATUS_MUTATING)
                        console.warn(`Property ${key} overridden manually anti-pattern`);
                } else {
                    state[key] = value;

                    console.log(`state update: ${key} => ${value}`);

                    This.publish(STATE_CHANGE, This.state);

                    if (This.status !== STATUS_MUTATING)
                        console.warn(`Property ${key} overridden manually anti-pattern`);

                    This.status = STATUS_IDLING;
                }

                return true;
            }
        });

        this.getState = function () {
            return Object.assign({}, This.state);
        }

        this.Events = options.evtNamespace || (new EventNamespace());

        /**
         * Subscribes to the store's EventNamespace
         * @param {string} evtName
         * @param {function} Callback
         * @param {function} [inActive] - An optional function, which may be used to clean up listeners for removed
         * @param thisArgument
         * @returns {ListenerEntry}
         */
        this.subscribe = function (
            evtName,
            Callback,
            inActive,
            thisArgument
        ) {
            if (typeof inActive !== "function")
                return this.Events.On(evtName, Callback, thisArgument || null);
            else
                return this.Events.When(evtName, Callback, true, inActive, thisArgument || null);
        }

        /**
         * Removes a listener from the store
         * @param {string} evtName
         * @param {function} Callback
         * @returns {undefined}
         */
        this.unsubscribe = function (
            evtName,
            Callback
        ) {
            return this.Events.Off(evtName, Callback);
        }

        /**
         *
         * @param {string} evtName
         * @param {*} Payload
         * @returns {Array}
         */
        this.publish = function (evtName, Payload) {
            return this.Events.Trigger(evtName, Payload);
        }

        // Allow adding actions+mutations later

        /**
         *
         * @param {string} actionName
         * @param {function} Callback
         * @returns {Store}
         */
        this.setAction = function (actionName, Callback) {
            if (this.actions[actionName])
                throw new NotImplementedException(`action[${actionName}]`);

            this.actions[actionName] = Callback;

            return this;
        }

        /**
         *
         * @param {string} mutationName
         * @param {function} Callback
         * @returns {Store}
         */
        this.setMutation = function (mutationName, Callback) {
            if (this.mutations[mutationName])
                throw new NotImplementedException(`action[${mutationName}]`);

            this.mutations[mutationName] = Callback;

            return this;
        }

        /**
         * ONLY FOR STORES/COMPONENTS connected via ConnectorReducable: Dispatch an action through the store
         * @param {string|function} actionKey - If a function was supplied, it will be cast to its name
         * @param {*} payload
         */
        this.dispatch = function (actionKey, payload) {
            let actionFunction;

            console.groupCollapsed(`ACTION: ${actionKey}`);
            This.status = STATUS_ACTING;

            if (typeof actionKey === "string") {
                if (typeof This.actions[actionKey] !== "function")
                    throw new InvalidTypeException(`actions[${actionKey}]`);

                actionFunction = This.actions[actionKey];
            } else if (typeof actionKey === "function") {
                actionFunction = actionKey;
            } else
                throw new InvalidTypeException("dispatch[actionInput]");

            let funcResult = actionFunction(This, payload);
            if (typeof funcResult === "function")
                funcResult(This.dispatch.bind(This));

            console.groupEnd();

            return true;
        }

        /**
         * Commit a mutation
         * @param {string} mutationKey
         * @param {*} payload
         */
        this.commit = function (mutationKey, payload) {
            if (typeof This.mutations[mutationKey] !== "function")
                throw new InvalidTypeException(`mutations[${mutationKey}]`);

            This.status = STATUS_MUTATING;

            // Merge new state with current state

            let newState = This.mutations[mutationKey](This.state, payload);
            This.state = Object.assign(This.state, newState);

            return true;
        }
    }
}

export default Store;
export {
    PatchedStoreUpdate
}