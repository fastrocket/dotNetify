﻿/* 
Copyright 2018 Dicky Suryadi

Licensed under the Apache License, Version 2.0 (the "License");
you may not use this file except in compliance with the License.
You may obtain a copy of the License at

    http://www.apache.org/licenses/LICENSE-2.0

Unless required by applicable law or agreed to in writing, software
distributed under the License is distributed on an "AS IS" BASIS,
WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
See the License for the specific language governing permissions and
limitations under the License.
 */
import _dotnetify from '../core/dotnetify';
import dotnetifyVM from '../core/dotnetify-vm';

if (typeof window == 'undefined') window = global;
let dotnetify = window.dotnetify || _dotnetify;

dotnetify.vue = {
	version: '1.0.0',
	viewModels: {},
	plugins: {},
	controller: dotnetify,

	// Internal variables.
	_responseSubs: null,
	_reconnectedSubs: null,
	_connectedSubs: null,
	_connectionFailedSubs: null,

	// Initializes connection to SignalR server hub.
	init: function() {
		const self = dotnetify.vue;

		if (!self._responseSubs) {
			self._responseSubs = dotnetify.responseEvent.subscribe((iVMId, iVMData) => self._responseVM(iVMId, iVMData));
		}

		if (!self._connectedSubs) {
			self._connectedSubs = dotnetify.connectedEvent.subscribe(() =>
				Object.keys(self.viewModels).forEach(vmId => !self.viewModels[vmId].$requested && self.viewModels[vmId].$request())
			);
		}

		const start = function() {
			if (!dotnetify.isHubStarted) Object.keys(self.viewModels).forEach(vmId => (self.viewModels[vmId].$requested = false));
			dotnetify.startHub();
		};

		if (!self._reconnectedSubs) {
			self._reconnectedSubs = dotnetify.reconnectedEvent.subscribe(start);
		}

		dotnetify.initHub();
		start();
	},

	// Connects to a server view model.
	connect: function(iVMId, iVue, iOptions) {
		if (arguments.length < 2) throw new Error('[dotNetify] Missing arguments. Usage: connect(vmId, component) ');

		const self = dotnetify.vue;
		if (!self.viewModels.hasOwnProperty(iVMId)) {
			const component = {
				get props() {
					let props = {};
					iVue.props && Object.keys(iVue.props).forEach(key => (props[key] = iVue.props[key]));
					return props;
				},
				get state() {
					return iVue.data;
				},
				setState(state) {
					Object.keys(state).forEach(key => (iVue[key] = state[key]));
				}
			};

			self.viewModels[iVMId] = new dotnetifyVM(iVMId, component, iOptions, self);

			if (Array.isArray(iOptions.watch)) self._addWatchers(iOptions.watch, self.viewModels[iVMId], iVue);
		} else
			console.error(
				`Component is attempting to connect to an already active '${iVMId}'. ` +
					` If it's from a dismounted component, you must add vm.$destroy to componentWillUnmount().`
			);

		self.init();
		return self.viewModels[iVMId];
	},

	// Get all view models.
	getViewModels: function() {
		const self = dotnetify.vue;
		return Object.keys(self.viewModels).map(vmId => self.viewModels[vmId]);
	},

	_addWatchers(iWatchlist, iVM, iVue) {
		iVM.$watched = [];
		const callback = prop =>
			function(newValue) {
				if (iVM.$watched.includes(prop)) iVM.$dispatch({ [prop]: newValue });
				else iVM.$watched.push(prop);
			}.bind(iVM);
		iWatchlist.forEach(prop => iVue.$watch(prop, callback(prop)));
	},

	_responseVM: function(iVMId, iVMData) {
		const self = dotnetify.vue;

		if (self.viewModels.hasOwnProperty(iVMId)) {
			const vm = self.viewModels[iVMId];
			dotnetify.checkServerSideException(iVMId, iVMData, vm.$exceptionHandler);
			vm.$update(iVMData);
			return true;
		}
		return false;
	}
};

export default dotnetify;
