"use strict";angular.module("acmanagerApp").factory("Session",["$resource",function($resource){return $resource("/auth/:domain",{domain:"@domain"})}]);
