/**
 * See class description
 * @module Client/UI/xInteraction
 */

export const X_INTERACTION_TRIGGER = "Trigger";
export const X_INTERACTION_START = "Start";
export const X_INTERACTION_MOVE = "Move";
export const X_INTERACTION_STOP = "Stop";

/**
 * Module for storing a xDMS UI Interaction
 * @class
 */
class xInteraction {
	/**
	 *
	 * @param {"Trigger"|"Start"|"Move"|"Stop"|"change"} Type
	 * @param {string} Name
	 * @param {function} Callback
	 * @param {*} [This]
	 * @param {*} [Arguments] - Preferably an array. May be converted to one
	 * @param {*} [Identifier]
	 */
	constructor(
		Type,
		Name,
		Callback,
		This,
		Arguments,
		Identifier
	) {
		this.Type = Type;
		this.Name = Name;
		this.Callback = Callback;

		this.This = This || undefined;
		this.Arguments = Arguments || undefined;
		this.Identifier = Identifier || undefined;
	}

}

export default xInteraction;