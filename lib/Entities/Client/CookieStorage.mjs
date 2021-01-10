import GenericException from "../Exceptions/GenericException.mjs";
import GenericStorage from "../Storage/GenericStorage.mjs";

class CookieStorage extends GenericStorage {
	/**
	 * @type {number}
	 */
	lifetime = 0;

	/**
	 *
	 * @param {string} Namespace
	 * @param {number} [lifetimeInDays=1]
	 * @param {string} [Domain=""]
	 */
	constructor(
		Namespace,
		lifetimeInDays,
		Domain = ""
	) {
		super(Namespace);

		this.lifetime = (lifetimeInDays || 1) * 24 * 60 * 60 * 1000 + 1;

		/**
		 *
		 * @type {string}
		 */
		this.Domain = Domain;

		this.Set = this.Set.bind(this);
		this.Get = this.Get.bind(this);
		this.Request = this.Request.bind(this);
		this.Remove  = this.Remove.bind(this);
		this.Exist  = this.Exist.bind(this);
		this.Keys = this.Keys.bind(this);
	}

	/**
	 *
	 * @param {string} Key
	 * @param {string|array|object} Value
	 * @param {number} lifetimeInDays
	 * @returns {Promise<boolean,Error>}
	 */
	async Set (
		Key,
		Value,
		lifetimeInDays = 1
	) {
		let This = this;

		if (lifetimeInDays === Infinity)
			lifetimeInDays = 10e5;

		// Support supplying an object
		if (typeof Key === "object")
			return Promise.all(Object.keys(Key).map((keyName) => This.Set(keyName, Key[keyName], lifetimeInDays) ));

		let expireDate = new Date();
		expireDate.setTime(expireDate.getTime() + (lifetimeInDays * 24 * 60 * 60 * 1000));

		let expiresString = "expires=" + expireDate.toUTCString();

		let Name = `${this.Namespace}_${Key}`;

		document.cookie = Name + "=" + Value + ";" + expiresString + ";path=/" + `${This.Domain !== "" ? `;domain=${This.Domain}` : ""}`;

		return true;
	}

	async Get (Key) {
		let Name = `${this.Namespace}_${Key}`;

		// See http://stackoverflow.com/questions/5968196/check-cookie-if-cookie-exists; Copyright by jac as of 14.04.2017
		let dc = document.cookie,
			prefix = Name + "=",
			begin = dc.indexOf("; " + prefix),
			end;

		if (begin == -1) {
			begin = dc.indexOf(prefix);
			if (begin != 0)
				return null;
			end = dc.indexOf("; ", begin + 1);
		} else {
			begin += 2;
			end = document.cookie.indexOf(";", begin);
			if (end == -1) {
				end = dc.length;
			}
		}

		return decodeURI(dc.substring(begin + prefix.length, end));
	}

	/**
	 *
	 * @param {string} Key
	 * @returns {Promise<[]|string>}
	 */
	async Request (Key) {
		let This = this;

		if (Key instanceof Array) {
			var keyValues = {};

			await Promise.all(Key.map(async function (Key) {
				keyValues[Key] = await This.Get(Key);
			}));

			return keyValues;
		} else {
			let Name = `${this.Namespace}_${Key}`;
			return This.Get(Name);
		}
	}

	async Exist (Key) {
		let This = this;
		let Name = `${this.Namespace}_${Key}`;

		return ((await This.Get(Name)) != null);
	}

	async Remove (Key) {
		let This = this;
		if (Key && (Key instanceof Array))
			return Promise.all(Key.map((cKey) => This.Remove(cKey)));

		let Name = `${this.Namespace}_${Key}`;

		document.cookie = Name + '=; expires=Thu, 01 Jan 1970 00:00:01 GMT;';

		return true;
	}

	async Keys () {
		let Cookies = document.cookie.split(';'),
			Keys = [];

		for (let i = 0 ; i < Cookies.length; i++) {
			if (Cookies[i] !== "")
				Keys.push(Cookies[i].substr(0, Cookies[i].indexOf("=")));
		}

		return Keys;
	}
}

export default CookieStorage;