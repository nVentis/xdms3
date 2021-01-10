import DataEndpointInterfaceRW from "./DataEndpointInterfaceRW.mjs";

class TestEndpoint extends DataEndpointInterfaceRW {
    constructor(Name) {
        super(Name);

        /**
         *
         * @type {string}
         */
        this.Value = "";

    }
}

async function asd() {
    let Test = new TestEndpoint(Name);
    let a = Test.getValue();

    Test.watchValue(function (a) {

    });

}

export default TestEndpoint;