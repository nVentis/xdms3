/**
 * See class
 * @module Server/PersistentStorageFS
 */

import GenericStorage from "../Storage/GenericStorage.mjs";
import InvalidStateException from "../Exceptions/InvalidStateException";
import * as FS from 'fs';

/**
 *
 * @type { Object.<string,PersistentStorageFS> }
 */
let PersistentStoragesFS = {};

/**
 * @description Namespaced key-value storage. Data is stored in an object that is kept synchronized with localStorage using the Save() and Load() methods
 * @class
 */
export default class PersistentStorageFS extends GenericStorage {
    /**
     * @param {string} Namespace
     * @param {string} dataFileLocation - Absolute path to filename
     * @returns {PersistentStorage}
     */
    constructor (Namespace, dataFileLocation) {
        super(Namespace);

        let This = this;

        this.Content = {};

        this.PFSStorageName = "PFSStorage#" + Namespace;

        // DO NOT allow multiple PersistenStorage entites of the same namespace
        // Keeping the values updated with events is way too overkill, instead,
        // use the same namespace (intended for exactly that) or be sure to use
        // another!
        if (PersistentStorages[this.PFSStorageName])
            return PersistentStorages[this.PFSStorageName];

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
            await FS.promises.writeFile(dataFileLocation, JSON.stringify(This.Content), {
                encoding: "utf8",
                flag: "w+"
            });

            return This;
        }

        this.Load = async function () {
            let fileContent = await FS.promises.readFile(dataFileLocation, {
                encoding: "utf8",
                flag: "a+"
            });

            let jsonContent;
            try {
                jsonContent = JSON.parse(fileContent);
            } catch (exception) {
                throw new InvalidStateException("fileContent");
            }

            This.Content = jsonContent;
            return This;
        }
    }
}