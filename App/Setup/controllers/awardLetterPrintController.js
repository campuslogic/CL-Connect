(function () {
    'use strict';

    angular
    .module('clConnectControllers')
    .controller('awardLetterPrintController', awardLetterPrintController);

    awardLetterPrintController.$inject = ['$scope', 'setupservice', 'validationservice'];

    function awardLetterPrintController($scope, setupservice, validationservice) {
        var vm = this;
        vm.service = setupservice;
        vm.validationService = validationservice;
        vm.awardLetterPrintSettingsValid = validationservice.pageValidations.awardLetterPrintSettingsValid;
        vm.pathIsValid = false;
    }
})();