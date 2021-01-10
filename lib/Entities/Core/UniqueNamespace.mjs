/**
 * See class description
 * @module Core/UniqueNamespace
 */

import IDGenerator from "./IDGenerator.mjs";
import IDGeneratorNumeric from "./IDGeneratorNumeric.mjs";
import InvalidTypeException from "../Exceptions/InvalidTypeException.mjs";

/**
 * A container for unique IDs of objects of the same type meant for session-usage
 * @class
 */
class UniqueNamespace {
	/**
	 * @param {string} Name
	 * @param {function} [Generator]
	 * @param {object} [GeneratorConstructorOptions]
	 */
	constructor(
		Name,
		Generator,
		IDGeneratorConstructorOptions = {}
	) {
		if (typeof Generator !== "function")
			throw new InvalidTypeException("Generator");

		if (!Generator)
			Generator = new IDGeneratorNumeric(IDGeneratorConstructorOptions);
		else
			Generator = new Generator(IDGeneratorConstructorOptions);

		/**
		 *
		 * @type {IDGenerator}
		 */
		this.Generator = Generator;
		this.Name = Name;

		this.Entries = {};

		/**
		 * Retrieves an ID from the associated Generator
		 * @param {*} [Content] - Optionally, an ID may be attached to specific content
		 * @param {boolean} [checkExistingIDs=false]
		 * @param {boolean} [nullIfNotFound=false]
		 * @returns {string|number|null}
		 */
		this.ID = function (Content, checkExistingIDs, nullIfNotFound) {
			if (typeof Content !== "undefined" && checkExistingIDs) {
				for (let i in this.Entries)
					if (this.Entries[i] === Content)
						return i;

				if (nullIfNotFound)
					return null;
			}

			var ID = this.Generator.Generate(this.Name, Content);
			if (!typeof this.Entries[ID] === "undefined")
				while (typeof this.Entries[ID] !== "undefined")
					ID = this.Generator.Generate(this.Name, Content);

			this.Entries[ID] = (typeof Content !== "undefined") ? Content : true;

			return ID;
		}

		/**
		 * Checks if an entry with the supplied ID already exists in this namespace
		 * @param {string|number} ID
		 * @returns {boolean}
		 */
		this.Exists = function (ID) {
			return this.Entries.hasOwnProperty(ID);
		}

		/**
		 * Changes the content assigned to a given ID, if possible
		 * @param {string|number} ID
		 * @param {*} Content
		 * @returns {boolean}
		 */
		this.Change = function (ID, Content) {
			if (this.Exists(ID)) {
				this.Entries[ID] = Content;

				return true;
			}

			return false;
		}

		/**
		 * Retrieve any content attached to an ID; defaults to true
		 * @param {string|number} ID
		 * @returns {*}
		 */
		this.Get = function (ID) {
			return this.Entries[ID];
		}

		/**
		 * Attempts to delete an ID from this namespace
		 * @param {string|number} ID
		 */
		this.Remove = function (ID) {
			delete this.Entries[ID];
		}
	}
}

export default UniqueNamespace;