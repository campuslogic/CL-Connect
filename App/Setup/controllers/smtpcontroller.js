(function () {
    'use strict';

    angular
    .module('clConnectControllers')
    .controller('smtpcontroller', smtpcontroller);

    smtpcontroller.$inject = ['$scope', 'setupservice', 'validationservice'];

    function smtpcontroller($scope, setupservice, validationservice) {
        $scope.service = setupservice;
        $scope.validationService = validationservice;
        if ($scope.service.configurationModel.smtpSection.deliveryMethod == 0)
            $scope.service.configurationModel.smtpSection.deliveryMethod = "Network"
        
        $scope.testSMTP = function (form) {
            $scope.validationService.testSMTPSettings(form);
        }
        
    }
})();