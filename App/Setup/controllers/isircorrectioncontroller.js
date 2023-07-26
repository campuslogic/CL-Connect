(function () {
    'use strict';

    angular
    .module('clConnectControllers')
    .controller('isircorrectioncontroller', isircorrectioncontroller);

    isircorrectioncontroller.$inject = ['$scope', 'setupservice', 'validationservice'];

    function isircorrectioncontroller($scope, setupservice, validationservice) {

        var vm = this;
        vm.service = setupservice;
        vm.validationService = validationservice;
        vm.isirCorrectionsSettings = vm.service.configurationModel.campusLogicSection.isirCorrectionsSettings;
        vm.isirCorrectionsValid = validationservice.pageValidations.isirCorrectionsValid;


        $("#daysToRun").kendoMultiSelect({
            dataTextField: "text",
            dataValueField: "value",
            valuePrimitive: true,
            autoBind: false,
            autoWidth: true,
            dataSource: daysToRunDataSource()
        });

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