(function () {
    'use strict';

    angular
    .module('clConnectControllers')
    .controller('fileStoreController', fileStoreController);

    fileStoreController.$inject = ['$scope', 'setupservice', 'validationservice'];

    function fileStoreController($scope, setupservice, validationservice) {
        var vm = this;
        vm.service = setupservice;
        vm.validationService = validationservice;
        vm.fileStoreSettingsValid = validationservice.pageValidations.fileStoreSettingsValid;
        vm.pathIsValid = false;
    }
})();