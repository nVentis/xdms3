/**
 * See class description
 * @module ObjectList
 */

import InvalidEntityException from "./Exceptions/InvalidEntityException.mjs";

/**
 * Module for managing unique objects of the same type
 * @class
 */
class ObjectList extends Array {
	/**
	 *
	 * @param {function} Entity - A class which the entities use to be constructed
	 * @param {string|number} uniqueProperty
	 * @param {*[]} [initialContent]
	 */
	constructor(
		Entity,
		uniqueProperty,
		initialContent = []
	) {
		super(...initialContent);

		if (Entity) {
			/**
			 * Checks if arguments comply to the class function passed upon construction and only adds them if they all comply
			 * @inheritDoc
			 */
			this.push = function () {
				for (var aIndex = 0; aIndex < arguments.length; aIndex++)
					if (!(arguments[aIndex] instanceof Entity))
						throw new InvalidEntityException(arguments[Index].name);

				return Array.prototype.push.apply(this, arguments);
			}

			/**
			 *
			 * @param {object} obj
			 * @returns {boolean|undefined}
			 */
			this.removeObj = function (obj) {
				if (!(obj instanceof Entity))
					throw new InvalidEntityException("obj");

				return this.removeBy(obj[uniqueProperty]);
			}
		}

		/**
		 * Retrieves an entity by comparing uniqueProperty or customProperty with Value
		 * @param {string|number} Value
		 * @param {string|number} cProperty
		 * @returns {object}
		 */
		this.findBy = function (Value, Property) {
			if (typeof Property === "undefined")
				Property = uniqueProperty;

			for (var cIndex = 0; cIndex < this.length; cIndex++) {
				let cItem = this[cIndex];
				if (cItem[Property] === Value)
					return cItem;
			}

			return undefined;
		}

		/**
		 * Checks if an entity exists
		 * @param {string|number} Value
		 * @param {string|number} [Property]
		 * @returns {boolean|undefined}
		 */
		this.exists = function (Value, Property) {
			if (typeof Property === "undefined")
				Property = uniqueProperty;

			for (var cIndex = 0; cIndex < this.length; cIndex++) {
				let cItem = this[cIndex];
				if (cItem[Property] === Value)
					return true
			}

			return undefined;
		}

		/**
		 * Removes and entity from the list, if it exists
		 * @param {string|number} Value
		 * @param {string|number} Property
		 * @returns {boolean|undefined}
		 */
		this.removeBy = function (Value, Property) {
			if (typeof Property === "undefined")
				Property = uniqueProperty;

			for (var cIndex = 0; cIndex < this.length; cIndex++) {
				let cItem = this[cIndex];
				if (cItem[Property] === Value)
					this.splice(cIndex, 1);
			}

			return undefined;
		}
	}
}

export {
	ObjectList
}