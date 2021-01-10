/**
 * See class
 * @module UDBI/FieldTypes/FieldTypeTimestamp
 */

import FieldTypeGeneric, {FieldTypeIDs} from "./FieldTypeGeneric.mjs";

/**
 * Used for defining tables
 * @class
 */
class FieldTypeTimestamp extends FieldTypeGeneric {
	/**
	 *
	 * @param {string} fieldName
	 * @param {FieldTypeOptions} Options - See also FieldTypeGeneric
	 * @param {number} Options.Precision
	 * @param {FieldTypeTimestampValueNow|number} Options.Default
	 */
	constructor(
		fieldName,
		Options = {}
	) {
		super(fieldName, FieldTypeIDs.Timestamp, {
			PK: !!Options.PK,
			Default: Options.Default
		});

		this.Precision = Options.Precision || null;
	}
}

/**
 * When supplied as a default timestamp value, all inserts will include the time on insert
 */
class FieldTypeTimestampValueNow {
	/**
	 *
	 * @param {number} Precision
	 */
	constructor(Precision = 6) {
		this.Precision = Precision;
	}
}

export default FieldTypeTimestamp;
export {
	FieldTypeTimestampValueNow
}