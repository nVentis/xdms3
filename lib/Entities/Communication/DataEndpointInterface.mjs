/**
 * See class
 * @module Entities/Communication/DataEndpointInterface
 */

import NotImplementedException from "../Exceptions/NotImplementedException.mjs";

class DataEndpointInterface {
    /**
     *
     * @param {string} Name
     */
    constructor(
        Name
    ) {
        let This = this;

        /**
         *
         * @type {string}
         */
        this.Name = Name;
    }

    async Request () {
        throw new NotImplementedException("DataEndpointInterface.Request");
    }
}

export default DataEndpointInterface;