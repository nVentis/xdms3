/**
 * @module Core/ProtectedNamespace
 */
import InvalidEntityException from "../Exceptions/InvalidEntityException.mjs";
import InvalidTypeException from "../Exceptions/InvalidTypeException.mjs";
import InvalidStateException from "../Exceptions/InvalidStateException";

export default class ProtectedNamespace {
	constructor() {
		// Where anything will be attached to (when using Register)
		this.Root = {};

		/**
		 * Registers a given value under the correct path
		 * @param {string|string[]} arrayPath
		 * @param Value
		 * @returns {ProtectedNamespace}
		 */
		this.Register = function (arrayPath, Value) {
			if (typeof arrayPath === "string")
				arrayPath = arrayPath.split(".");

			if (!arrayPath || !(arrayPath instanceof Array))
				throw new InvalidEntityException("arrayPath");

			if (typeof Value === "undefined")
				throw new InvalidTypeException("Value");

			let cScope = this.Root;
			while (arrayPath.length){
				let cKey = arrayPath.shift().toLowerCase();
				if (arrayPath.length) {
					if (typeof cScope[cKey] === "undefined")
						cScope[cKey] = {};

					cScope = cScope[cKey];
				} else
					cScope[cKey] = Value;
			}

			return this;
		}

		/**
		 * Resolves an arrayPath to a value
		 * @param arrayPath
		 * @returns {{}}
		 */
		this.Get = function (arrayPath) {
			if (typeof arrayPath === "string")
				arrayPath = arrayPath.split(".");

			if (!arrayPath || !(arrayPath instanceof Array))
				throw new InvalidEntityException("arrayPath");

			let cScope = this.Root;
			while (arrayPath.length){
				let cKey = arrayPath.shift().toLowerCase();
				if (typeof cScope[cKey] !== "undefined")
					cScope = cScope[cKey];
				else
					throw new InvalidStateException("Root");
			}

			return cScope;
		}

	}
}