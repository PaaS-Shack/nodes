"use strict";
const DbService = require("db-mixin");
const { MoleculerClientError } = require("moleculer").Errors;


/**
 * Addons service
 */
module.exports = {
	name: "nodes.ports",
	version: 1,

	mixins: [
		DbService({

		}),
	],

	/**
	 * Service dependencies
	 */
	dependencies: [],

	/**
	 * Service settings
	 */
	settings: {
		rest: "/v1/nodes/:node/ports",


		fields: {

			network: {
				type: "string",
				min: 3,
				required: true,
				//validate: 'validateNode'
				populate: {
					action: "v1.nodes.networks.resolve",
					params: {
						fields: ["id", "address", "node", "internal", "public", "tunnel"]
					}
				}
			},

			number: {
				type: 'number',
				required: true
			},


			type: {
				type: 'enum',
				values: ['tcp', 'udp', 'http'],
				default: 'tcp',
				required: false
			},
			detect: {
				type: 'boolean',
				default: false,
				required: false
			},
		},
		defaultPopulates: [],

		scopes: {

		},

		defaultScopes: []
	},

	crons: [
		{
			name: "ClearExpiredNodes",
			cronTime: "* * * * *",
			onTick: {
				//action: "v1.nodes.clearExpiredNodes"
			}
		}
	],
	/**
	 * Actions
	 */
	actions: {
		create: {
			permissions: ['nodes.ports.get']
		},
		list: {
			permissions: ['nodes.ports.get']
		},
		find: {
			rest: "GET /find",
			permissions: ['nodes.ports.get']
		},
		count: {
			rest: "GET /count",
			permissions: ['nodes.ports.get']
		},
		get: {
			needEntity: true,
			permissions: ['nodes.ports.get']
		},
		update: {
			needEntity: true,
			permissions: ['nodes.ports.get']
		},
		replace: false,
		remove: {
			needEntity: true,
			permissions: ['nodes.ports.get']
		},

		resolvePort: {
			description: "Add members to the addon",
			params: {
				network: { type: "string", optional: true },
				number: { type: "number", optional: true },
			},
			async handler(ctx) {
				const params = Object.assign({}, ctx.params);
				return this.findEntity(null, {
					query: {
						...params
					},
					populate: ['network']
				});
			}
		},
	},


	/**
	 * Events
	 */
	events: {

	},

	/**
	 * Methods
	 */
	methods: {
		async validateHasNetworkPermissions(query, ctx, params) {
			// Adapter init
			if (!ctx) return query;

			if (params.network) {
				const res = await ctx.call("v1.nodes.networks.resolve", {
					id: params.network,
					throwIfNotExist: false
				});
				if (res) {
					query.network = params.network;
					return query;
				}
				throw new MoleculerClientError(
					`You have no right for the network '${params.network}'`,
					403,
					"ERR_NO_PERMISSION",
					{ network: params.network }
				);
			}
			if (ctx.action && ctx.action.params.network && !ctx.action.params.network.optional) {
				throw new MoleculerClientError(`network is required`, 422, "VALIDATION_ERROR", [
					{ type: "required", field: "network" }
				]);
			}
		},

		validateNetwork(args) {
			const { ctx, params, value } = args
			return ctx.call("v1.nodes.networks.resolve", {
				id: params.network,
				throwIfNotExist: false,
				fields: ['id']
			}).then(res => {
				if (res) {
					return true
				} else {
					return `node '${params.network}' is not found.`
				}
			}
			).catch(err => err);
		},
		async validateHasNodePermissions(query = {}, ctx, params) {
			// Adapter init
			if (!ctx) return query;

			if (params.node) {
				const res = await ctx.call("v1.nodes.resolve", {
					id: params.node,
					throwIfNotExist: false
				});
				if (res) {
					query.node = params.node;
					return query;
				}
				throw new MoleculerClientError(
					`You have no right for the node '${params.node}'`,
					403,
					"ERR_NO_PERMISSION",
					{ node: params.node }
				);
			}
			if (ctx.action && ctx.action.params.node && !ctx.action.params.node.optional) {
				throw new MoleculerClientError(`node is required`, 422, "VALIDATION_ERROR", [
					{ type: "required", field: "node" }
				]);
			}
		},
		async clearExpiredNodes(ctx) {
			const nodes = await this.findEntities(ctx, {
				query: { online: true, updatedAt: { $lte: Date.now() - (15 * 60 * 1000) } }
			});

			const promises = []
			for (let index = 0; index < nodes.length; index++) {
				const node = nodes[index];
				promises.push(this.updateEntity(
					ctx,
					{
						id: node.id,
						online: false,
						onlineAt: null,
						offlineAt: Date.now(),
					},
					{ permissive: true }
				));
			}
			return Promise.allSettled(promises)
		},

		validateNode(args) {
			const { ctx, params, value } = args
			return ctx.call("v1.nodes.resolve", {
				id: params.node,
				throwIfNotExist: false,
				fields: ['id']
			}).then(res => {
				if (res) {
					return true
				} else {
					return `node '${params.node}' is not found.`
				}
			}
			).catch(err => err);
		},
	},

	/**
	 * Service created lifecycle event handler
	 */
	created() { },

	/**
	 * Service started lifecycle event handler
	 */
	started() { },

	/**
	 * Service stopped lifecycle event handler
	 */
	stopped() { }
};
