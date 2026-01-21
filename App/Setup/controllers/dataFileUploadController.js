(function () {
    'use strict';

    angular
        .module('clConnectControllers')
        .controller('datafileuploadcontroller', datafileuploadcontroller);

    datafileuploadcontroller.$inject = ['$scope', 'setupservice', 'validationservice'];

    function datafileuploadcontroller($scope, setupservice, validationservice) {
        var vm = this;
        vm.service = setupservice;
        vm.validationService = validationservice;
        vm.dataFileUploadSettings = vm.service.configurationModel.campusLogicSection.dataFileUploadSettings;
        vm.daysToRunOptions = {
            dataTextField: "text",
            dataValueField: "value",
            valuePrimitive: true,
            autoBind: false,
            dataSource: daysToRunDataSource()
        };

        function daysToRunDataSource() {
            return new kendo.data.DataSource({
                data: [
                    { text: "Sunday", value: "SUN" },
                    { text: "Monday", value: "MON" },
                    { text: "Tuesday", value: "TUE" },
                    { text: "Wednesday", value: "WED" },
                    { text: "Thursday", value: "THUR" },
                    { text: "Friday", value: "FRI" },
                    { text: "Saturday", value: "SAT" }
                ]
            });
        }
    }
})();