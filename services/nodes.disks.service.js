"use strict";

const DbService = require("db-mixin");
const ConfigLoader = require("config-mixin");

const { MoleculerClientError } = require("moleculer").Errors;


/**
 * Addons service
 */
module.exports = {
	name: "nodes.disks",
	version: 1,

	mixins: [
		DbService({
			entityChangedEventMode: 'emit'
		}),
		ConfigLoader(['nodes.**'])
	],

	/**
	 * Service dependencies
	 */
	dependencies: [],

	/**
	 * Service settings
	 */
	settings: {
		rest: "/v1/nodes/:node/disks",


		fields: {
			

			node: {
				type: "string",
				required: true,
				populate: {
					action: "v1.nodes.resolve",
					params: {
						fields: ["id", "online", 'hostname', 'nodeID']
					}
				}
			},

			path: {
				type: "string",
				required: false
			},
			type: {
				type: "enum",
				values: ["ssd", "nvme", "raid0", "flash", "disk"],
				immutable: true,
				required: true,
			},
			size: {
				type: "number",
				required: true
			},
			device: {
				type: "string",
				required: true
			},

		},
		defaultPopulates: [],

		scopes: {
			async node(query, ctx, params) { return this.validateHasNode(query, ctx, params) },
		},

		defaultScopes: ["node"]
	},

	/**
	 * Actions
	 */
	actions: {
		create: {
			permissions: ['domains.create'],
			params: {
				node: { type: "string" }
			}
		},
		list: {
			permissions: ['domains.list'],
			params: {
				node: { type: "string", optional: true }
			}
		},
		find: {
			rest: "GET /find",
			permissions: ['domains.find'],
			params: {
				node: { type: "string", optional: true }
			}
		},
		count: {
			rest: "GET /count",
			permissions: ['domains.count'],
			params: {
				node: { type: "string" }
			}
		},
		get: {
			needEntity: true,
			permissions: ['domains.get'],
			params: {
				node: { type: "string" }
			}
		},
		update: {
			needEntity: true,
			permissions: ['domains.update'],
			params: {
				node: { type: "string" }
			}
		},
		replace: false,
		remove: {
			needEntity: true,
			permissions: ['domains.remove'],
			params: {
				node: { type: "string" }
			}
		},

		query: {
			description: "Add members to the addon",
			params: {

				public: { type: "boolean", optional: true },
				tunnel: { type: "boolean", optional: true },
				internal: { type: "boolean", optional: true },
				docker: { type: "boolean", optional: true },
				address: { type: "string", optional: true },
				node: { type: "string", optional: true },
			},
			async handler(ctx) {
				const params = Object.assign({}, ctx.params);
				return this.findEntities(null, {
					query: {
						...params
					},
					populate: ['node']
				});
			}
		},

		address: {
			description: "Add members to the addon",
			params: {
				address: { type: "string", optional: true },
			},
			async handler(ctx) {
				const params = Object.assign({}, ctx.params);
				return this.findEntity(null, {
					query: {
						...params
					},
					populate: ['node']
				});
			}
		},


	},

	/**
	 * Events
	 */
	events: {

		async "nodes.removed"(ctx) {
			const node = ctx.params.data;
			try {
				const attachments = await this.findEntities(ctx, {
					query: { node: node.id },
					fields: ["id"],
					scope: false
				});
				await this.Promise.all(
					attachments.map(attachment => this.removeEntity(ctx, { id: attachment.id, scope: false }))
				);
				this.logger.info(`Node '${node.id}' network removed ${attachments.map(attachment => attachment.id).join()}`);
			} catch (err) {
				this.logger.error(`Unable to delete attachments of node '${node.id}'`, err);
			}
		},
		async "nodes.online"(ctx) {
			const { nodeID, id: node } = ctx.params;

		},
	},

	/**
	 * Methods
	 */
	methods: {
		async validateHasNode(query, ctx, params) {
			// Adapter init
			if (!ctx) return query;

			if (params.node) {
				const res = await ctx.call("v1.nodes.resolve", {
					id: params.node
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
