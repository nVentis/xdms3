/**
 * See class
 * @module Client/ComponentConnectorInterface
 */

import ViewComponent from "./UI/ViewComponent.mjs";
import Store from "./Store.mjs";
import NotImplementedException from "../Exceptions/NotImplementedException.mjs";

class ComponentConnectorInterface {
    /**
     *
     * @param {function(new:ViewComponent)} Component
     * @param {Store} theStore
     */
    constructor(
        Component,
        theStore
    ) {
        /**
         *
         * @type {function(new:ViewComponent)}
         */
        this.Component = Component;

        /**
         *
         * @type {Store}
         */
        this.Store = theStore;

        /**
         * Receives implementation-specific arguments to connect components and stores
         * @returns {ViewComponent}
         */
        this.connect = function () {
            throw new NotImplementedException("ComponentConnectorInterface.connect");
        }
    }
}

export default ComponentConnectorInterface;