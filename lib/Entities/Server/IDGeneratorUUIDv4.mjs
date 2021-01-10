/**
 * See class description
 * @module Server/IDGeneratorUUIDv4
 */
import IDGenerator from "../Core/IDGenerator.mjs";
import uuid from 'uuid';

let uuidv4 = uuid.v4;

/**
 * Class for generating ID values conforming to UUIDv4 standard
 * @class
 */
class IDGeneratorUUIDv4 extends IDGenerator {
	constructor() {
		let IDGeneratorFunction = function (namespaceName, Content, Options) {
			//console.log(uuidv4.default);
			return uuidv4();
		}

		super(IDGeneratorFunction);
	}
}

export default IDGeneratorUUIDv4;