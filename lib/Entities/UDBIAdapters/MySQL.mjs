/**
 * May be abstracted to Objection-Adapter instead of MySQL-Adapter (supporting PostgreSQL)
 */

import knex from "knex";
import objection from "objection";
import { ObjectManager } from "../UDBI/ObjectManager.mjs";
import InvalidStateException from "../Exceptions/InvalidStateException.mjs";
import ConfigCurrent from "../Config/ConfigCurrent.mjs";
import {UDBIDatabase, UDBITable, UDBITableSchema} from "../UDBI/Core.mjs";
import {ObjectList} from "../ObjectList.mjs";
import InvalidTypeException from "../Exceptions/InvalidTypeException.mjs";
import {FieldTypeIDs} from "../UDBI/FieldTypes/FieldTypeGeneric.mjs";

import FieldTypeInteger from "../UDBI/FieldTypes/FieldTypeInteger.mjs";
import FieldTypeString from "../UDBI/FieldTypes/FieldTypeString.mjs";
import FieldTypeText from "../UDBI/FieldTypes/FieldTypeText.mjs";
import FieldTypeFloat from "../UDBI/FieldTypes/FieldTypeFloat.mjs";
import FieldTypeBigInteger from "../UDBI/FieldTypes/FieldTypeBigInteger.mjs";
import FieldTypeTimestamp, {FieldTypeTimestampValueNow} from "../UDBI/FieldTypes/FieldTypeTimestamp.mjs";
import FieldTypeGeneric from "../UDBI/FieldTypes/FieldTypeGeneric.mjs";

/**
 * Represents a connection to a mysql database
 * In combination with MySQLDatabaseList, makes sure connections are only made a single time to the same database
 * @class
 */
class MySQLDatabase extends UDBIDatabase {
	/**
	 *
	 * @param {knex} knexInstance
	 * @param {MySQLDBConnectionDescriptor} connectionDescriptor
	 */
	constructor(
		knexInstance,
		connectionDescriptor
	) {
		super(connectionDescriptor.databaseName);

		/**
		 *
		 * @type {knex}
		 */
		this.knex = knexInstance;

		this.conDescriptor = connectionDescriptor;
	}
}


let MySQLDatabaseList = new ObjectList(MySQLDatabase, "dbName");


/**
 * Includes references for manipulating a mysql database table
 * @class
 */
class MySQLTable extends UDBITable {
	/**
	 *
	 * @param {string} tableName
	 * @param {MySQLDatabase} mysqlDatabase
	 * @param {object} Options
	 * @param {UDBITableSchema} [Options.Schema]
	 */
	constructor(
		tableName,
		mysqlDatabase,
		Options = {}
	) {
		super(tableName);

		this.Database = mysqlDatabase;
		this.knex = mysqlDatabase.knex;

		this.Schema = Options.Schema || null;
	}
}

/**
 * Used for establishing connections to MySQL servers
 * @class
 */
class MySQLDBConnectionDescriptor {
	/**
	 *
	 * @param {string} hostAddress
	 * @param {string} databaseName
	 * @param {string} userName
	 * @param {string} Password
	 */
	constructor(
		hostAddress,
		databaseName,
		userName,
		Password
	) {
		this.hostAddress = hostAddress;
		this.databaseName = databaseName;
		this.userName = userName;

		/**
		 * May only be called once
		 * @returns {string}
		 */
		this.getPassword = function () {
			if (Password !== null) {
				let pw = "" + Password;
				Password = null;

				return pw;
			} else
				throw new InvalidStateException("Password");
		}
	}
}

/**
 * Used for applying UDBITableSchema entities
 * @class
 */
class MySQLSchemaBuilder {
	/**
	 *
	 * @param {string|MySQLDatabase} databaseEntityOrName
	 * @param {objection.Model} managedEntity
	 */
	constructor(
		databaseEntityOrName,
		managedEntity
	) {
		if (!(databaseEntityOrName instanceof MySQLDatabase)) {
			if (typeof databaseEntityOrName === "string") {
				databaseEntityOrName = MySQLDatabaseList.findBy(databaseEntityOrName);
				if (!databaseEntityOrName)
					throw new InvalidStateException("databaseEntityOrName");
			} else
				throw new InvalidTypeException("databaseEntityOrName");
		}

		let This = this;

		/**
		 * @type {MySQLDatabase}
		 */
		let mysqlDB = databaseEntityOrName;

		/**
		 * Checks if a table exists and if all required columns exist
		 * @param {string} tableName
		 * @param {UDBITableSchema} udbiSchema
		 * @returns {Promise<MySQLTable>}
		 */
		this.checkSchema = async function (
			tableName,
			udbiSchema
		) {
			let tableExists = await mysqlDB.knex.schema.hasTable(tableName);
			if (!tableExists)
				return This.applySchema(tableName, udbiSchema);

			// Check if all columns exist
			// TODO: Create remaining columns?
			return new MySQLTable(tableName, mysqlDB, {
				Schema: udbiSchema
			});
		}

		/**
		 *
		 * @param {string} tableName
		 * @param {UDBITableSchema} udbiSchema
		 * @returns {Promise<MySQLTable>}
		 */
		this.applySchema = async function (
			tableName,
			udbiSchema
		) {
			await mysqlDB.knex.schema.createTable(tableName, function (knexTable) {
				let primaryKeys = [];

				for (let udbiSchemaEntry of udbiSchema.fieldTypes) {
					var knexColumn;
					switch (udbiSchemaEntry.Type) {
						case FieldTypeIDs.Integer:
							/**
							 * @type {FieldTypeInteger}
							 */
							let intEntry = udbiSchemaEntry;
							let intColumn;

							if (intEntry.autoIncrement)
								intColumn = knexTable.increments(intEntry.Name);
							else
								intColumn = knexTable.integer(intEntry.Name);

							knexColumn = intColumn;

							break;

						case FieldTypeIDs.String:
							/**
							 *
							 * @type {FieldTypeString}
							 */
							let stringEntry = udbiSchemaEntry;
							let stringColumn = knexTable.string(stringEntry.Name, stringEntry.Length);

							knexColumn = stringColumn;

							break;

						case FieldTypeIDs.Text:
							/**
							 *
							 * @type {FieldTypeText}
							 */
							let textEntry = udbiSchemaEntry;
							let textColumn = knexTable.text(textEntry.Name, textEntry.textType);

							knexColumn = textColumn;

							break;

						case FieldTypeIDs.Float:
							/**
							 *
							 * @type {FieldTypeFloat}
							 */
							let floatEntry = udbiSchemaEntry;
							let floatColumn = knexTable.float(floatEntry.Name, floatEntry.Precision || null, floatEntry.Scale || null);

							knexColumn = floatColumn;

							break;

						case FieldTypeIDs.Timestamp:
							/**
							 *
							 * @type {FieldTypeTimestamp}
							 */
							let timestampEntry = udbiSchemaEntry;
							let timestampColumn = knexTable.timestamp(timestampEntry.Name, {
								precision: timestampEntry.Precision
							});

							knexColumn = timestampColumn;

							break;

						case FieldTypeIDs.BigInteger:
							/**
							 *
							 * @type {FieldTypeBigInteger}
							 */
							let bigIntegerEntry = udbiSchemaEntry;
							let bigIntegerColumn;

							if (bigIntegerEntry.autoIncrement)
								bigIntegerColumn = knexTable.bigIncrements(bigIntegerEntry.Name);
							else
								bigIntegerColumn = knexTable.bigInteger(bigIntegerEntry.Name);

							knexColumn = bigIntegerColumn;

							break;
					}

					// For all supported types
					if (udbiSchemaEntry.Nullable)
						knexColumn = knexColumn.nullable();
					else
						knexColumn = knexColumn.notNullable();

					if (typeof udbiSchemaEntry.Default !== "undefined") {
						if (udbiSchemaEntry.Type === FieldTypeIDs.Timestamp &&
							udbiSchemaEntry.Default instanceof FieldTypeTimestampValueNow) {
							knexColumn = knexColumn.defaultTo(mysqlDB.knex.fn.now(udbiSchemaEntry.Default.Precision));
						} else {
							knexColumn = knexColumn.defaultTo(udbiSchemaEntry.Default);
						}
					}

					if (udbiSchemaEntry.Unsigned)
						knexColumn = knexColumn.unsigned();

					if (udbiSchemaEntry.isUnique)
						knexColumn = knexColumn.unique();

					if (udbiSchemaEntry.isIndex)
						knexColumn = knexColumn.index();

					if (udbiSchemaEntry.PK === true) {
						primaryKeys.push(udbiSchemaEntry.Name);
					} else if (udbiSchemaEntry.refColumn) {
						if (!udbiSchemaEntry.isIndex)
							knexColumn = knexColumn.index();

						knexColumn = knexColumn.references(udbiSchemaEntry.refColumn);

						if (udbiSchemaEntry.refTable)
							knexColumn = knexColumn.inTable(udbiSchemaEntry.refTable);

						if (udbiSchemaEntry.onDelete)
							knexColumn = knexColumn.onDelete(udbiSchemaEntry.onDelete);

						if (udbiSchemaEntry.onUpdate)
							knexColumn = knexColumn.onDelete(udbiSchemaEntry.onUpdate);
					}
				}

				// For all supported types
				if (primaryKeys.length)
					knexTable.primary(primaryKeys);
			});

			console.log(`Inserting base entities for <${managedEntity.name}>`);

			// After table was successfully created, insert
			if (udbiSchema.Options && udbiSchema.Options.Base) {
				let baseGraphs;
				if (typeof udbiSchema.Options.baseInit === "function")
					baseGraphs = await udbiSchema.Options.baseInit (udbiSchema.Options.Base);
				else
					baseGraphs = udbiSchema.Options.Base;

				await Promise.all(baseGraphs.map(
					(baseGraph) => managedEntity.query().insertGraph(baseGraph)
				));
			}

			return new MySQLTable(tableName, mysqlDB, {
				Schema: udbiSchema
			});
		}
	}
}

/**
 * Most notably, this ObjectManager holds the knex and objection references
 * @class
 */
class MySQLObjectManager extends ObjectManager {
	/**
	 *
	 * @param {objection.Model} ManagedEntity
	 * @param {MySQLDBConnectionDescriptor} Connection
	 * @param {UDBITableSchema} [Schema]
	 */
	constructor(
		ManagedEntity,
		Connection = {},
		Schema = null
	) {
		// e.g. "RepositoryAccessToken" => "repository_access_token"
		let tableName =
			(Schema && Schema.Options && Schema.Options.Name) ? Schema.Options.Name : ManagedEntity.name.match(/[A-Z]+(?![a-z])|[A-Z]?[a-z]+|\d+/g).join('_').toLowerCase();

		super(ManagedEntity, tableName);

		let This = this;

		/**
		 * @returns {MySQLObjectManager}
		 */
		this.Request = async function () {
			/**
			 * @type {MySQLDatabase}
			 */
			let databaseInstance = MySQLDatabaseList.findBy(Connection.databaseName);

			if (!databaseInstance) {
				let pw = Connection.getPassword();
				if (pw === null)
					throw new InvalidStateException("Connection.getPassword");

				let knexInstance = knex({
					client: "mysql",
					connection: {
						host: Connection.hostAddress,
						database: Connection.databaseName,
						user: Connection.userName,
						password: pw
					},
					asyncStackTraces: !!ConfigCurrent.devMode
				});

				databaseInstance = new MySQLDatabase(knexInstance, Connection);
				MySQLDatabaseList.push(databaseInstance);

				This.knex = knexInstance;
			} else
				This.knex = databaseInstance.knex;

			//console.log(`Connecting entity <${ManagedEntity.name}>`);
			ManagedEntity.knex(This.knex);

			// Check table integrity (check against schema)
			if (Schema) {
				let schemaBuilder = new MySQLSchemaBuilder(databaseInstance, ManagedEntity);
				await schemaBuilder.checkSchema(tableName, Schema);
			}

			return This;
		}

		/**
		 *
		 * @returns {objection.QueryBuilder}
		 */
		this.createQueryBuilder = function () {
			return ManagedEntity.query();
		}

		/**
		 * For use with RXIContainers
		 */
		this.Init = this.Request;
	}
}

export {
	MySQLObjectManager,
	MySQLDBConnectionDescriptor
}