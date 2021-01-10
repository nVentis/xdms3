/**
 * See class
 * @module Entities/Communication/DataEndpointInterfaceRW
 */
import {EventNamespace} from "../Event/Namespace.mjs";
import NotImplementedException from "../Exceptions/NotImplementedException.mjs";
import DataEndpointInterface from "./DataEndpointInterface.mjs";

const DATA_ENDPOINT_UPDATE_ACTIVE = "DATA_ENDPOINT_UPDATE_ACTIVE";
const DATA_ENDPOINT_UPDATE_PASSIVE = "DATA_ENDPOINT_UPDATE_PASSIVE";

class DataEndpointInterfaceRW extends DataEndpointInterface {
    /**
     *
     * @param {string} Name
     */
    constructor(
        Name
    ) {
        super(Name);

        let This = this;

        /**
         * Value controlled by this Endpoint
         * @type {null}
         */
        this.Value = null;

        // Store event namespace internally
        let eventNamespace = new EventNamespace();

        /**
         * May be called
         * @returns {Promise<void>}
         */
        this._getValue = async function () {
            throw new NotImplementedException("_getValue");
        }

        /**
         * Trigger an external change of Value
         * @returns {Promise<void>}
         */
        this._setValue = async function (Value) {
            this.Value = Value;
            eventNamespace.Trigger(DATA_ENDPOINT_UPDATE_PASSIVE, This);
        }

        this.getValue = function () {
            return this.Value;
        }

        this.setValue = function (Value) {
            this.Value = Value;
            return this;
        }

        /**
         * See DATA_ENDPOINT_UPDATE_ACTIVE, DATA_ENDPOINT_UPDATE_PASSIVE
         * @param {string} stateChange
         * @param {function} Listener
         * @param {boolean} triggerListenerOnRegistration
         */
        this.listenFor = function (stateChange, Listener, triggerListenerOnRegistration) {
            eventNamespace.On(stateChange, function () {
                return Listener(This.Value);
            });
        }

        /**
         * Watches for external changes of Value
         * @param {function} Listener
         * @returns {DataEndpointInterfaceRW}
         */
        this.watchValue = function (Listener) {
            this.listenFor(DATA_ENDPOINT_UPDATE_PASSIVE, Listener, true);

            return this;
        }
    }
}

export default DataEndpointInterfaceRW;
export {
    DATA_ENDPOINT_UPDATE_ACTIVE,
    DATA_ENDPOINT_UPDATE_PASSIVE
}