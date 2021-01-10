/**
 * See class
 * @module UDBI/FieldTypes/FieldTypeGeneric
 */

let FieldTypeIDs = {
	String: "STRING",
	Integer: "INT",
	Text: "TEXT",
	BigInteger: "BIGINT",
	Float: "FLOAT",
	Timestamp: "TIMESTAMP"
}

export const FIELD_ON_DELETE = {
	CASCADE: "CASCADE"
}

export const FIELD_ON_UPDATE = {
	CASCADE: "CASCADE"
}

/**
 * @typedef {object} FieldTypeOptions
 * @property {boolean} [PK]
 * @property {boolean} [Nullable=true]
 * @property {*} [Default]
 * @property {string} [refColumn]
 * @property {string} [refTable]
 * @property {boolean} [isIndex=false]
 * @property {boolean} [isUnique=false]
 * @property {boolean} [Unsigned=false]
 * @property {string} [onDelete] - See possible values in FIELD_ON_DELETE
 * @property {string} [onUpdate] - See possible values in FIELD_ON_UPDATE
 */

/**
 * Used for defining table schemas
 * @class
 */
class FieldTypeGeneric {
	/**
	 *
	 * @param {string} Name
	 * @param {string} Type
	 * @param {FieldTypeOptions} [Options]
	 */
	constructor(
		Name,
		Type,
		Options
	) {
		if (!Options)
			Options = {}

		if (typeof Options.Nullable === "undefined")
			Options.Nullable = true;

		this.Name = Name;
		this.Type = Type;

		this.PK = !!Options.PK;
		this.Nullable = !!Options.Nullable;
		this.Default = Options.Default;

		this.refColumn = Options.refColumn;
		this.refTable = Options.refTable;
		this.isIndex = !!Options.isIndex;
		this.isUnique = !!Options.isUnique;

		this.Unsigned = !!Options.Unsigned;

		this.onDelete = (typeof Options.onDelete === "string") ? Options.onDelete : "";
		this.onUpdate = (typeof Options.onUpdate === "string") ? Options.onUpdate : "";
	}
}

export default FieldTypeGeneric;
export {
	FieldTypeIDs
}