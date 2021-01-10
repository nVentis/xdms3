/**
 * See class
 * @module Entities/Client/PersistentStorage
 */

import GenericStorage from "../Storage/GenericStorage.mjs";
import InvalidStateException from "../Exceptions/InvalidStateException.mjs";

/**
 *
 * @type { Object.<string,PersistentStorage> }
 */
let PersistentStorages = {};

/**
 * @description Namespaced key-value storage. Data is stored in an object that is kept synchronized with localStorage using the Save() and Load() methods
 * @class
 */
export default class PersistentStorage extends GenericStorage {
	/**
	 *
	 * @param {string} Namespace
	 */
	constructor (Namespace) {
		super(Namespace);

		let This = this;

		this.Content = {};

		this.localStorageName = "PSStorage#" + Namespace;

		// DO NOT allow multiple PersistenStorage entites of the same namespace
		// Keeping the values updated with events is way too overkill, instead,
		// use the same namespace (intended for exactly that) or be sure to use
		// another!
		if (PersistentStorages[this.localStorageName])
			return PersistentStorages[this.localStorageName];

		this.autoSave = false;
		this.autoLoad = false;

		this.Set = async function (Key, Value) {
			This.Content[Key] = Value;

			if (This.autoSave)
				return await This.Save();
			else
				return This;
		}

		this.Get = async function (Key) {
			if (This.autoLoad) {
				await This.Load();
				return This.Content[Key];
			} else
				return This.Content[Key];
		}

		this.Exist = async function (Key) {
			if (This.autoLoad) {
				await This.Load();
				return (typeof This.Content[Key] !== "undefined");
			} else
				return (typeof This.Content[Key] !== "undefined");
		}

		this.Key = async function (Value) {
			if (This.autoLoad)
				await This.Load();

			for (let cProperty in This.Content) {
				if (This.Content[cProperty] === Value)
					return cProperty;
			}

			return undefined;
		}

		this.Keys = async function () {
			if (This.autoLoad)
				await This.Load();

			return Objeys.keys(This.Content);
		}

		this.Remove = async function (Key) {
			if (This.autoLoad)
				await This.Load();

			delete This.Content[Key];
			if (This.autoSave)
				return await This.Save();
			else
				return This;
		}

		this.Save = async function () {
			let Temp = JSON.stringify(This.Content);
			window.localStorage.setItem(This.localStorageName, Temp);

			return This;
		}

		this.Load = async function () {
			//try {
				let Result = window.localStorage.getItem(This.localStorageName);

				if (typeof Result === "string") {
					// Convert to JSON and return
					This.Content = JSON.parse(Result);
					return This;
				} else if (Result === null) {
					// If the entry does not (yet) exist,
					// save the current value for later use
					return await This.Save();
				} else {
					console.log("Ignoring invalid variables. Overwrite?");
					console.log(Result);
					throw new InvalidStateException("window.localStorage.getItem");
					//return This;
				}
			/*} catch (errorInfo) {
				return errorInfo;
			}*/
		}
	}
}

export {
	PersistentStorages, PersistentStorage
}