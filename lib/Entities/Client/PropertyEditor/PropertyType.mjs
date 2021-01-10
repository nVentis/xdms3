/**
 * Classes for data model definition
 */

import NotImplementedException from "../../Exceptions/NotImplementedException.mjs";
import {EntityStorage, rootEntityStorageCollection} from "./EntityStorage.mjs";
import InvalidStateException from "../../Exceptions/InvalidStateException.mjs";
import InvalidTypeException from "../../Exceptions/InvalidTypeException";
import IDGenerator from "../../Core/IDGenerator";
import PropertyConstraint from "./PropertyConstraint.mjs";

/**
 * A custom property type
 */
class PropertyType {
	static _compiled = false;

	/**
	 *
	 * @type {string}
	 */
	static typeName = "GenericObject";

	/**
	 * May be user supplied
	 * @param a
	 */
	static Validator (a) {
		throw new NotImplementedException(`Validator of <${this.typeName}> not defined`);
	}


	/**
	 *
	 * @param a
	 * @return {boolean}
	 */
	static Validate (a) {
		return !!this.Validator(a);
	}
}

class PropertyTypeNone extends PropertyType {
	static typeName = "GenericNone";
	static Validator = (val) => (val && val instanceof PropertyTypeNone);
}

export const IS_TEMPLATE_PROPERTY_NAME = "__isTemplate"; // property which will be set true for items created by addTemplate

/**
 * @typedef {object} StaticPropertyTypeDefinition
 * @property {string|PropertyType} dataType
 * @property {string|number|IDGenerator} [defaultValue]
 * @property {*} [emptyValue]
 * @property {boolean} [Nullable=false]
 * @property {PropertyConstraint[]} [Constraints]
 * @property {boolean} [deleteIfEmpty=false] - Applies only to collections (arrays). After an edit to a collection or any child is made, all items parenting the edited item
 * 	will be checked for emptyness by calling .isEmpty(). If that evaulates to true and deleteIfEmpty is true as well, the collection itself will be removed. Parenting
 * 	collections will not be checked afterwards.
 */

/**
 * Allows defining data models and validating/comparing objects against them
 * @property {Obejct<string, StaticPropertyTypeDefinition>} [definedProperties] - Use .compile()
 *
 * @class
 */
class PropertyTypeObject extends PropertyType {
	/**
	 * Will be assigned when the first EntityStorage is created using this PropertyType
	 * @type {EntityStorage}
	 */
	static entityStorage = null;

	/**
	 *
	 * @type {string}
	 */
	static idProperty = "id";

	/**
	 *
	 * @type {Object<string, StaticPropertyTypeDefinition>}
	 */
	static definedProperties = {};

	/**
	 *
	 * @return {string[]}
	 */
	static definedPropertiesWithoutId () {
		let result = Object.keys(this.definedProperties);
		let idIndex = result.indexOf(this.idProperty);
		if (idIndex !== -1)
			result.splice(idIndex, 1);

		return result;
	}

	/**
	 * Sets up the relational mappings through object traversal
	 * Must be called before usage e.g. in EntityStorage
	 */
	static compile () {
		if (this._compiled)
			return;

		this._compiled = true;

		if (typeof this.definedProperties !== "object")
			throw new InvalidTypeException("definedProperties");

		this.Properties = {};
		this.defaultValues = {};
		this.emptyValues = {};
		this.Constraints = {};
		this.Nullable = {};

		for (let propertyName in this.definedProperties) {
			/**
			 * @type {StaticPropertyTypeDefinition}
			 */
			let propertyEntry = this.definedProperties[propertyName];

			this.Properties[propertyName] = propertyEntry.dataType;

			if (typeof propertyEntry.defaultValue !== "undefined")
				this.defaultValues[propertyName] = propertyEntry.defaultValue;

			if (typeof propertyEntry.emptyValue !== "undefined")
				this.emptyValues[propertyName] = propertyEntry.emptyValue;

			if (typeof propertyEntry.Constraints !== "undefined")
				this.Constraints[propertyName] = propertyEntry.Constraints;

			if (propertyEntry.Nullable)
				this.Nullable[propertyName] = true;
		}

		let definedPropertiesWithoutId = this.definedPropertiesWithoutId();

		this.definedPropertiesWithoutId = () => definedPropertiesWithoutId;

		if (typeof this.typeName !== "string")
			this.typeName = this.name;
	}

	/**
	 *
	 * @param {string} fieldName
	 * @param {PropertyConstraint} someConstraint
	 */
	static addConstraint (
		fieldName,
		someConstraint
	) {
		if (!this.Properties[fieldName]) {
			console.error(this);
			throw new Error(`Property <${fieldName}> not registered`);
		}

		if (!this.Constraints[fieldName] || !(this.Constraints[fieldName] instanceof Array))
			this.Constraints[fieldName] = [];

		this.Constraints[fieldName].push(someConstraint);

		return this;
	}

	/**
	 * For deletion of objects, it is neccessary to define an "empty representation"
	 * Per default, we treat completely objects with completely zeroed properties as deleted
	 *
	 * @param {object} someObject
	 */
	static isEmpty (someObject) {
		return (someObject && Object.keys(this.Properties).every((propertyName) => (someObject[propertyName] == (typeof this.emptyValues[propertyName] !== "undefined" ? this.emptyValues[propertyName] : 0)) ));
	}

	/**
	 * Required for keeping Nullable properties consistent. Per default, a simple check is done
	 *
	 * @param someObject
	 * @return {boolean}
	 */
	static isNull (someObject) {
		return !someObject;
	}

	/**
	 * Returns an entity representing an empty data structure
	 * @returns {{}}
	 */
	static getEmpty () {
		let emptyEntity = {};

		for (let Property of this.definedPropertyNames())
			emptyEntity[Property] = 0;

		return emptyEntity;
	}

	/**
	 * Parses a given object according to the definitions supplied by PropertyType
	 * @param {object} objectIn
	 * @param {PropertyConstraintAttached|PropertyConstraintAttached[]} additionalConstraints
	 * @param {boolean} verbose
	 * @returns {null|object}
	 */
	static toThis (
		objectIn,
		additionalConstraints,
		verbose = false
	) {
		if (!objectIn)
			return null;

		console.log("objectIn");
		console.log(objectIn);

		// First check types, then constraints
		let out = {},
			errOccured = false;

		let getParsedRec = function (contextOut, contextIn, propertyType) {
			if (propertyType) {
				if (propertyType instanceof PropertyTypeObject) {
					for (let propertyName in propertyType.Properties) {
						let cPropertyType = propertyType.Properties[propertyName];

						/**
						 * @type {PropertyConstraint[]}
						 */
						let	cPropertyConstraints = propertyType.Constraints[propertyName];

						if (typeof contextIn[propertyName] !== "undefined") {
							if (cPropertyType instanceof PropertyTypeObject) {
								contextOut[propertyName] = {};

								getParsedRec(contextOut[propertyName], contextIn[propertyName], cPropertyType);

								// Check constraints
							} else if (typeof cPropertyType === "string") {
								// Compare typeof
								if (cPropertyType !== typeof contextIn[propertyName]) {
									if (verbose)
										console.log(`Inequal types supplied for ${propertyName}`);

									errOccured = true;
									return false;
								}

								// Check constraints
								if (cPropertyConstraints && cPropertyConstraints.length)
									for (let cConstraint of cPropertyConstraints) {
										if (!cConstraint.Check(contextIn[propertyName])) {
											if (verbose)
												console.log(`Constraint violation for ${propertyName}`);

											errOccured = true;
											return false;
										}
									}

								// Attach value if all checks were successful
								contextOut[propertyName] = contextIn[propertyName];
							} else {
								if (verbose)
									console.log(`Invalid cPropertyType for propertyName ${propertyName}`);

								errOccured = true;
								return false;
							}
						}
					}
				} else if (propertyType instanceof PropertyTypeCollection) {
					throw new NotImplementedException("toThis:PropertyTypeCollection");
				}  else {
					if (verbose)
						console.log(`Unexpected property for toThis parsing`);

					errOccured = true;
					return false;
				}
			} else {
				if (verbose)
					console.log(`propertyType invalid`);

				errOccured = true;
				return false;
			}
		}

		getParsedRec(out, objectIn, this);

		if (!errOccured) {
			// TODO: Check constraints
			if (additionalConstraints && !(additionalConstraints instanceof Array))
				additionalConstraints = [additionalConstraints];

			return out;
		} else
			return null;
	}

	/**
	 *
	 * @returns {string[]}
	 */
	static definedPropertyNames () {
		return Object.keys(this.Properties);
	}

	/**
	 *
	 * @returns {Object<string, PropertyType|string>}
	 */
	static definedPropertyItems () {
		return this.Properties;
	}

	constructor(props) {
		super(props);

		if (this.constructor.idProperty) {
			let defaultValues = this.constructor.defaultValues;
			if (defaultValues) {
				for (let defaultProperty in defaultValues) {
					let defaultValue = defaultValues[defaultProperty];
					if (defaultValue) {
						if (defaultValue instanceof IDGenerator)
							this[defaultProperty] = defaultValue.Generate();
						else if (defaultValue instanceof PropertyTypeObject) {
							let a = new defaultValue.prototype();
							this[defaultProperty] = Object.assign(a, defaultValue);
						} else
							this[defaultProperty] = defaultValues[defaultProperty];
					} else
						this[defaultProperty] = defaultValues[defaultProperty];
				}
			}
		}

		// console.log(this.constructor);
	}
}

/**
 * Allows comparing arrays of items with each other using serialization.
 * If an entityType is set manually, its validation and serialization will be used for all children.
 * @property {PropertyType} entityType
 * @property {number} [maxMembers] - Preferably defined as static.
 * @class
 */
class PropertyTypeCollection extends PropertyType {
	/**
	 * Must be set manually to the PropertyTypeObject class
	 * @type {PropertyTypeObject}
	 */
	static entityType = null;

	/**
	 * The maximum amount of children this collection may hold to be validated
	 * @type {number}
	 */
	static maxMembers = Infinity;

	/**
	 * If supplied, this may be used in calls to getProperties. Per default, the entity ID will be used
	 * @type {string}
	 */
	static sortProperty = null;

	/**
	 * Used to make new syntax using static methods conform the "old" way of creating PropertyType instances
	 */
	static compile () {
		if (this._compiled)
			return;

		this._compiled = true;

		console.log(this.entityType);

		if (!this.entityType || !(this.entityType.prototype instanceof PropertyTypeObject))
			throw new InvalidTypeException("this.entityType");

		this.typeName = `${this.entityType.typeName}Collection`;

		if (!this.sortProperty)
			this.sortProperty = this.entityType.idProperty;
	}
}

export default PropertyType;
export {
	PropertyTypeObject,
	PropertyTypeCollection,
	PropertyTypeNone
}