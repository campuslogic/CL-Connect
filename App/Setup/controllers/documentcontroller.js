(function () {
    'use strict';

    angular
    .module('clConnectControllers')
    .controller('documentcontroller', documentcontroller);

    documentcontroller.$inject = ['$scope', 'setupservice', 'validationservice'];

    function documentcontroller($scope, setupservice, validationservice) {
        var vm = this;
        vm.service = setupservice;
        vm.validationService = validationservice;
        vm.documentSettingsValid = validationservice.pageValidations.documentSettingsValid;
        vm.pathIsValid = false;
    }
})();