/**
 * See class
 * @module Entities/Communication/CommunicationSocket
 */
import ConnectionProvider from "../Server/ConnectionProvider.mjs";
import NotImplementedException from "../Exceptions/NotImplementedException.mjs";
import UniqueNamespace from "../Core/UniqueNamespace.mjs";
// import IDGeneratorUUIDv4 from "../Server/IDGeneratorUUIDv4.mjs";
import InvalidTypeException from "../Exceptions/InvalidTypeException.mjs";
import IDGeneratorNumeric from "../Core/IDGeneratorNumeric.mjs";
import InvalidStateException from "../Exceptions/InvalidStateException.mjs";
import RequestTimeoutException from "../Exceptions/RequestTimeoutException.mjs";
import InvalidEntityException from "../Exceptions/InvalidEntityException.mjs";

/**
 * A bridging class to allow abstract socket operations over anything that may be implemented using sockets
 * @class
 */
class CommunicationSocket  {
	/**
	 *
	 * @param {ConnectionProvider} [Connection] - Can be set later as well
	 */
	constructor(Connection) {
		var This = this;

		This.Settings = {
			Peer: null,
			Port: null,
			Name: null,
			startRequired: true,
			Timeout: {
				Request: 60000,
				Authenticate: 5000
			}
		}

		/**
		 * Set by by _Initialize
		 * @type {boolean}
		 */
		This.Initialized = false;

		/**
		 * A function returning a flag which is true only if a socket connection has been established by Connection
		 * @type {function}
		 */
		This.Connected = function () { return This.Connection.Connected(); }

		/**
		 * Establishing connection
		 * @type {boolean}
		 */
		This.Started = false;

		/**
		 * Set by _Authenticate
		 * @type {boolean}
		 */
		This.Authenticated = false;

		/**
		 * Set by _Authenticate, object with subjectId, sessionToken and validUntil properties
		 * @type {object|null}
		 */
		This.Session = null;

		/**
		 * Set by Start
		 * @type {ConnectionProvider|null}
		 */
		This.Connection = Connection || null;

		/**
		 * The transport socket
		 * @type {SocketIOClient.Socket}
		 */
		This.Socket = null;

		/**
		 *
		 * @returns {SocketIOClient.Socket}
		 */
		This.getSocket = function () {
			return This.Socket;
		}

		// data communication
		This.socketOn = function () {
			throw new NotImplementedException("socketOn");
		};
		This.socketOnce = function () {
			throw new NotImplementedException("socketOne");
		};
		This.socketEmit = function () {
			throw new NotImplementedException("socketEmit");
		};
		This.socketEnd = function () {
			throw new NotImplementedException("socketEnd");
		};
		This.socketOff = function () {
			throw new NotImplementedException("socketOff");
		};

		This.IDNamespace = new UniqueNamespace("socketConnection::" + This.Settings.Name + "::Requests", IDGeneratorNumeric);
		This.dataRequests = [];
		This.dataRequest = function (requestData, eventName) {
			var dataRequest = this;

			// Create ID for this dataRequest
			this.ID = This.IDNamespace.ID();
			requestData._ID = this.ID;

			this.eventName = eventName;
			this.Resolve = function () {
				// Delete from global register
				This.IDNamespace.Remove(dataRequest.ID);

				// Delete from local register
				for (let drIndex = 0; drIndex < This.dataRequests.length; drIndex++) {
					if (This.dataRequests[drIndex].ID === dataRequest.ID)
						return This.dataRequests.splice(drIndex, 1);
				}
			}
			this.Payload = requestData;
			this.Dispatch = function (eventName) {
				if (eventName)
					dataRequest.eventName = eventName;

				return new Promise(function (onSuccess, onError) {
					This.Socket.emit(dataRequest.eventName || "Request", dataRequest.Payload);

					if (onSuccess instanceof Function)
						dataRequest.onSuccess.push(onSuccess);

					if (onError instanceof Function)
						dataRequest.onError.push(onError);
				});
			}
			this.onSuccess = [];
			this.onError = [];

			This.dataRequests.push(this);

			return this;
		}

		// Use This.Start(), not _Initialize, _Connect or _Authenticate
		/**
		 * @param {object} loginRequest
		 * @param {string} [Name]
		 * @param {ConnectionProvider} [Connection] - Connection over which the CommunicationSocket may be implemented
		 * @returns {Promise<unknown>}
		 * @constructor
		 */
		This.Start = function (loginRequest, Name, Connection) {
			// Manage overloading
			//if (!(Connection instanceof ConnectionProvider))
			//	Connection = This.Connection;

			return new Promise(function (onSuccess, onError) {
				if (!This.loginRequest) {
					This.loginRequest = loginRequest;
					This._Initialize(Connection, Name);

					var onConnect = function () {
						This._Authenticate(loginRequest).then(onSuccess, onError);
					};

					This.Started = true;
					// This.Connection.socketEvents.onError.push(onError);
					This.Connection.On("connectionError", onError);

					if (This.Connection.Connected()) {
						// A connection has already been established by the underlying Connection

						return onConnect();
					} else {
						// The underlying Connection will connect in the future - attach listeners

						return This.Connection.On("connectionSuccess", onConnect);
						//return This.Connection.socketEvents.onConnect.push(onConnect);
					}
				} else
					return onSuccess();
			});
		}

		/**
		 * Helper method to intialize properties for connection
		 * @param {ConnectionProvider} Connection
		 * @param {string} [Name]
		 * @returns {boolean}
		 * @private
		 */
		This._Initialize = function (Connection, Name ) {
			//if (!(Connection instanceof ConnectionProvider))
			//	throw new InvalidTypeException("Connection");

			// Save in Universal.Connection.Socket
			This.Connection = Connection;
			This.Socket = Connection.Socket;

			// Save Settings from Connection
			var Options = This.Connection.getOptions();

			This.Settings.Peer = Options.Host || Connection.Peer;
			This.Settings.Port = Options.Port || Connection.Port;
			This.Settings.Name = Name || ((This.loginRequest.Username || This.loginRequest.eMail) + "@" + This.Settings.Peer + ":" + This.Settings.Port);
			This.Initialized = true;

			if (!This.Settings.startRequired)
				This.Authenticated = true;

			return true;
		}

		/**
		 * Attempts to use an already existing (authenticated / connected / etc.) connection
		 * @param {ConnectionProvider} Connection
		 * @param {object} loginRequest
		 * @param {object} Session
		 * @param {number} [connectionState=3]
		 */
		This.Use = function (Connection, loginRequest, Session, connectionState = 3) {
			This.loginRequest = loginRequest;
			This.Session = Session;

			This._Initialize(Connection);

			if (connectionState > 0)
				This.Started = true;
			if  (connectionState > 2) {
				This.Authenticated = true;
				This._Finalize();
			}
		}

		This._Finalize = function () {
			This.Connection.socketOn("Answer", function (answerObject) {
				// Check if the request was successful
				var Successful = answerObject.Successful,
					callbackType = Successful ? "onSuccess" : "onError";

				for (var rIndex = 0; rIndex < This.dataRequests.length; rIndex++) {
					var dataRequest = This.dataRequests[rIndex];
					if (answerObject._ID === dataRequest.ID) {
						for (var cIndex = 0; cIndex < dataRequest[callbackType].length; cIndex++)
							dataRequest[callbackType][cIndex](answerObject.Payload);

						dataRequest.Resolve();
					}
				}
			});
		}

		/**
		 *
		 * @param {object} requestData
		 * @param {string} [eventName="Request"]
		 * @returns {Promise<*>}
		 * @constructor
		 */
		This.Request = function (requestData, eventName = "Request") {
			return new Promise(function (onSuccess, onError) {
				if (!This.Authenticated)
					return onError(new InvalidStateException("Socket not authenticated"));

				// Only for debugging
				// [OFD][START]
				/*
				var onErrorE = function () {
					console.log({
						eventName: eventName,
						requestData: requestData,
						arguments: arguments
					});

					if (onError instanceof Function)
						return onError.apply(this, arguments);
				}*/
				// [OFD][END]

				var Request = new This.dataRequest(requestData);
					Request.Dispatch(eventName).then(onSuccess, onError/*E*/);
			});
		}

		This._Authenticate = function (loginRequest) {
			return new Promise(function (onSuccess, onError) {
				if (!loginRequest || (!loginRequest.Password || !(loginRequest.Username || loginRequest.eMail)) == (!loginRequest.sessionToken || !loginRequest.subjectId))
					return onError(new InvalidEntityException("Invalid loginRequest supplied"));

				This.Connection.socketEmit("Authenticate", loginRequest);
				This.Connection.socketOnce("Authenticated", function (sessionInfo) {
					// [a I] - subjectId
					// [a S] - sessionToken
					// [a T] - validUntil

					This.Authenticated = true;
					This.Session = sessionInfo;

					// Enable This.Request communication
					This._Finalize();

					return onSuccess(sessionInfo);
				});

				This.Connection.Once("connectionDisconnect", function (Message) {
					if ((new Date()).getTime() - This.Settings.Timeout.Authenticate < This.Connection.connectionStarted)
						return onError(new InvalidStateException("Socket disconnected", "PRE_AUTH_DISCON").setContent(Message));
				});

				// Manually implemented connectionTimeout
				setTimeout(function () {
					if (!This.Authenticated) {
						This.Connection.End();

						return onError(new RequestTimeoutException("Authentication timed out", "AUTH_TIMEOUT"));
					}
				}, This.Settings.Timeout.Authenticate);
			});
		}
	}
}

export default CommunicationSocket;