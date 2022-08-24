"use strict";



const C = require("../constants");

const DbService = require("db-mixin");
const ConfigLoader = require("config-mixin");


const { MoleculerClientError } = require("moleculer").Errors;


/**
 * Addons service
 */
module.exports = {
	name: "nodes.mounts",
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
		rest: "/v1/nodes/:node/mounts",


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

			device: {
				type: "string",
				required: true,
				populate: {
					action: "v1.nodes.disks.resolve",
					params: {
						//fields: ["id", "online", 'hostname', 'nodeID']
					}
				}
			},
			mountpoint: {
				type: "string",
				required: false
			},
			type: {
				type: "enum",
				values: ["nfs", "local"],
				immutable: true,
				required: true,
			},


		},
		defaultPopulates: [],

		scopes: {
			async node(query, ctx, params) { return this.validateHasNode(query, ctx, params) }
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
				//node: { type: "string" }
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

		async "nodes.mounts.removed"(ctx) {
			const mount = ctx.params.data;

			if (mount == 'local') {
				return console.log(`local mount`)
			}

			const node = await ctx.call('v1.nodes.resolve', { id: mount.node })
			console.log(`umount ${mount.mountpoint}`)
			let res = await ctx.call('v1.node.cmd', {
				cmd: `umount ${mount.mountpoint}`
			}, {
				nodeID: node.nodeID
			}).catch(console.log)
			console.log(res)
			res = await ctx.call('v1.node.cmd', {
				cmd: `rm -rf ${mount.mountpoint}/`
			}, {
				nodeID: node.nodeID
			}).catch(console.log)
			console.log(res)
		},
		async "nodes.mounts.created"(ctx) {
			const mount = ctx.params.data;

			if (mount == 'local') {
				return console.log(`local mount`)
			}

			const node = await ctx.call('v1.nodes.resolve', { id: mount.node })
			const device = await ctx.call('v1.nodes.disks.resolve', { id: mount.device })
			let network = await ctx.call('v1.nodes.networks.query', {
				node: device.node,
				family: 'ipv4',
				internal: true
			}).then((res) => res.shift());

			if (!network) {
				network = await ctx.call('v1.nodes.networks.query', {
					node: device.node,
					family: 'ipv4',
					tunnel: true
				}).then((res) => res.shift());
			}

			let res = await ctx.call('v1.node.cmd', {
				cmd: `mkdir ${mount.mountpoint}`
			}, {
				nodeID: node.nodeID
			}).catch(console.log)
			console.log(res)
			res = await ctx.call('v1.node.cmd', {
				cmd: `mount -t nfs ${network.address}:${device.path} ${mount.mountpoint}`
			}, {
				nodeID: node.nodeID
			}).catch(console.log)
			console.log(res)

		},
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
