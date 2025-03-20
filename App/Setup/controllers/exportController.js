(function () {
    'use strict';

    angular
        .module('clConnectControllers')
        .controller('exportController', exportController);

    exportController.$inject = ['$scope', 'exportservice', 'setupservice', 'configurations'];

    function exportController($scope, exportservice, setupservice, configurations) {
        $scope.days = 7;
        $scope.tables = [];
        $scope.addRemove = addRemove;
        $scope.setupservice = setupservice;
        $scope.exportLogs = function () {
            var request = {
                Days: $scope.days,
                Tables: $scope.tables
            };

            exportservice.exportLogs.save(request, function (response) {
                console.log(response);
                alert('Logs exported successfully');
            }, function (error) {
                console.error(error);
                alert('Failed to export logs');
            });
        };

        if (!$scope.setupservice.configurationModel) {
            $scope.setupservice.configurationModel = configurations;
        }

        $scope.dataFileUploadEnabled = $scope.setupservice.configurationModel.campusLogicSection.dataFileUploadSettings.dataFileUploadEnabled;

        // add table if not exists in $scope.tables remove it if it does
        function addRemove(table) {
            var index = $scope.tables.indexOf(table);
            if (index === -1) {
                $scope.tables.push(table);
            } else {
                $scope.tables.splice(index, 1);
            }
        };
    }
})();
