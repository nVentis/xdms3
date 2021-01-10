import {PropertyTypeObject,PropertyTypeCollection} from "./PropertyType.mjs";

/**
 * Used of hinting that a constraint may apply for a given value
 */
class PropertyConstraint {
	/**
	 *
	 * @param {function} checkFunc - May only return true if the given value conforms the constraint
	 * @param {string} validationFailedText
	 * 	Multiple values are available, so they will be replaced on run-time
	 */
	constructor(
		checkFunc,
		{
			validationFailedText = "Data invalid due to unknown reason."
		} = {}
	) {
		/**
		 *
		 * @param {any} someValue
		 * @returns {boolean}
		 */
		this.Check = function (someValue) {
			return checkFunc(someValue);
		}
	}
}

/**
 * Represents a collection of possible values for a certain property. Supports both strings and compound objects (when propertyType is supplied)
 */
class PropertyConstraintItemInList extends PropertyConstraint {
	/**
	 *
	 * @param {Array} valueList
	 * @param {PropertyTypeCollection} [valueListType]
	 */
	constructor(
		valueList,
		valueListType = null
	) {
		if (!valueList)
			throw new Error(`Invalid valueList supplied`);

		if (valueListType && !(valueListType instanceof PropertyTypeCollection))
			throw new Error(`Invalid PropertyTypeCollection supplied`);

		let checkFunc;
		if (!valueListType) {
			checkFunc = function (someValue) {
				for (let i = 0; i < valueList.length; i++) {
					if (valueList[i] === someValue)
						return true;
				}
				return false;
			}
		} else {
			let idProperty = valueListType.entityType.idProperty;
			checkFunc = function (someValue) {
				if (!someValue)
					return false;

				for (let i = 0; i < valueList.length; i++) {
					if (valueList[i] && valueList[i][idProperty] === someValue[idProperty])
						return true;
				}
				return false;
			}
		}

		super(checkFunc);

		this.valueList = valueList;
	}
}

/**
 * May be supplied to a PropertyTypeObject.toThis method
 * Checks if a constraint applies for a given namedLocation that may be resolved using contextResolve and the object passed to toThis
 * Helpful for constructing sets of request handlers, i.e. performing checks before an entity is added to a database
 */
class PropertyConstraintAttached extends PropertyConstraint {
	constructor(namedLocation, checkFunc) {
		super(checkFunc);

		this.namedLocation = namedLocation;
	}
}

export default PropertyConstraint;
export {
	PropertyConstraintAttached,
	PropertyConstraintItemInList
}