/**
 * See class
 * @module UDBI/FieldTypes/FieldTypeText
 */

import FieldTypeGeneric, {FieldTypeIDs} from "./FieldTypeGeneric.mjs";

/**
 * Used for defining tables
 * @class
 */
class FieldTypeText extends FieldTypeGeneric {
	/**
	 *
	 * @param {string} fieldName
	 * @param {"text"|"mediumtext"|"longtext"} textType
	 * @param {FieldTypeOptions} [Options]
	 */
	constructor(
		fieldName,
		textType = "text",
		Options
	) {
		super(fieldName, FieldTypeIDs.Text, Options);

		this.textType = textType;
	}
}

export default FieldTypeText;