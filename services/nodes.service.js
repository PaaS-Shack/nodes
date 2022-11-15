"use strict";
const DbService = require("db-mixin");
const Cron = require("cron-mixin");
const ConfigLoader = require("config-mixin");
const { MoleculerClientError } = require("moleculer").Errors;

/**
 * Addons service
 */
module.exports = {
	name: "nodes",
	version: 1,

	mixins: [
		DbService({
			entityChangedEventMode: 'emit',
			collection: 'nodes'
		}),
		ConfigLoader(['nodes.**']),
		Cron
	],

	/**
	 * Service dependencies
	 */
	dependencies: [],


	/**
	 * Service settings
	 */
	settings: {
		rest: "/v1/nodes",

		fields: {
			name: {
				type: "string",
				required: false,
				trim: true,
			},

			nodeID: {
				type: "string",
				required: false,
				trim: true,
			},
			online: {
				type: "boolean",
				required: false,
			},

			hostname: {
				type: "string",
				required: false,
				trim: true,
			},

			arch: {
				type: "string",
				required: false,
				trim: true,
			},
			platform: {
				type: "string",
				required: false,
				trim: true,
			},
			memory: {
				free: {
					type: "number",
					required: false,
				},
				total: {
					type: "number",
					required: false,
				},
				percent: {
					type: "number",
					required: false,
				},
				used: {
					type: "number",
					required: false,
				}
			},
			cpu: {
				vendor: {
					type: "string",
					required: false,
					trim: true,
				},
				family: {
					type: "string",
					required: false,
					trim: true,
				},
				model: {
					type: "string",
					required: false,
					trim: true,
				},
				speedString: {
					type: "string",
					required: false,
					trim: true,
				},
				cores: {
					type: "number",
					required: false,
				},
				load1: {
					type: "number",
					required: false,
				},
				load5: {
					type: "number",
					required: false,
				},
				load15: {
					type: "number",
					required: false,
				},
				utilization: {
					type: "number",
					required: false,
				},
				speed: {
					type: "number",
					required: false,
				}
			},
			type: {
				type: "string",
				required: false,
				trim: true,
			},
			release: {
				type: "string",
				required: false,
				trim: true,
			},
			uptime: {
				type: "number",
				required: false,
			},
			user: {
				uid: {
					type: "number",
					required: false,
				},
				gid: {
					type: "number",
					required: false,
				},
				username: {
					type: "string",
					required: false,
					trim: true,
				},
				homedir: {
					type: "string",
					required: false,
					trim: true,
				},
				shell: {
					type: "string",
					required: false,
					trim: true,
				}
			},

			networks: {
				type: "array",
				virtual: true,
				populate: function (ctx, values, entities, field) {
					return Promise.all(
						entities.map(async entity => {
							return entity.networks = await ctx.call("v1.nodes.networks.find", {
								node: this.encodeID(entity._id),
								query: { docker: false },
								fields: ['id', 'address', 'family', "internal", "public", "tunnel"]
							})
							return entity
						})
					);
				}
			},
		},
		defaultPopulates: [],

		scopes: {

		},

		defaultScopes: []
	},


	crons: [
		{
			name: "Scrape nodes",
			cronTime: "*/5 * * * *",
			onTick: {
				action: "v1.nodes.scrapeNodes"
			}
		}
	],
	/**
	 * Actions
	 */
	actions: {
		create: {
			permissions: ['domains.create']
		},
		list: {
			permissions: ['domains.list']
		},
		find: {
			rest: "GET /find",
			permissions: ['domains.find']
		},
		count: {
			rest: "GET /count",
			permissions: ['domains.count']
		},
		get: {
			needEntity: true,
			permissions: ['domains.get']
		},
		update: {
			needEntity: true,
			permissions: ['domains.update']
		},
		replace: false,
		remove: {
			needEntity: true,
			permissions: ['domains.remove']
		},
		resolveNode: {
			description: "Add members to the addon",
			params: {
				node: { type: "string", optional: false },
			},
			async handler(ctx) {
				const params = Object.assign({}, ctx.params);
				const fields = ['id', 'nodeID', 'online', 'hostname', 'arch', 'platform', 'createdAt', 'updatedAt']
				let res = await this.findEntity(null, {
					query: {
						hostname: params.node
					},
					fields
				});
				if (!res) {
					res = await this.findEntity(null, {
						query: {
							nodeID: params.node
						},
						fields
					});
				}
				return res;
			}
		},
		scrapeNodes: {
			description: "Add members to the addon",
			params: {

			},
			async handler(ctx) {
				const params = Object.assign({}, ctx.params);

				const nodes = await this.findEntities(ctx, {

				});
				return await this.Promise.all(
					nodes.map(node => this.actions.processNode({ nodeID: node.nodeID }, { parentCtx: ctx }))
				);
			}
		},
		writeCert: {
			description: "Add members to the addon",
			params: {
				nodeID: { type: "string", optional: false },
				domain: { type: "string", optional: false },

				cert: { type: "string", optional: false },
				key: { type: "string", optional: false },
			},
			async handler(ctx) {
				const params = Object.assign({}, ctx.params);

				const cert = await ctx.call('v1.certificates.resolveDomain', {
					domain: params.domain
				})

				return Promise.allSettled([
					ctx.call('v1.node.fs.writeFile', {
						path: params.cert,
						data: cert.cert
					}, { nodeID: params.nodeID }),
					ctx.call('v1.node.fs.writeFile', {
						path: params.key,
						data: cert.privkey
					}, { nodeID: params.nodeID })
				])

			}
		},

		networks: {
			rest: 'GET /networks',
			description: "Add members to the addon",
			params: {

			},
			async handler(ctx) {
				const params = Object.assign({}, ctx.params);

				return ctx.call('v1.nodes.networks.find', params)
			}
		},
		disks: {
			rest: 'GET /disks',
			description: "Add members to the addon",
			params: {

			},
			async handler(ctx) {
				const params = Object.assign({}, ctx.params);

				return ctx.call('v1.nodes.disks.find', params)
			}
		},
		mounts: {
			rest: 'GET /mounts',
			description: "Add members to the addon",
			params: {

			},
			async handler(ctx) {
				const params = Object.assign({}, ctx.params);

				return ctx.call('v1.nodes.mounts.find', {
					...params,
					populate: ['device', 'node']
				})
			}
		},
		stats: {
			rest: 'GET /stats',
			description: "Add members to the addon",
			params: {

			},
			async handler(ctx) {
				const params = Object.assign({}, ctx.params);
				const nodes = await this.findEntities(ctx, {

				});
				const stats = {
					cpu: 0,
					memory: 0,
					memoryUsed: 0
				}


				for (let index = 0; index < nodes.length; index++) {
					const node = nodes[index];
					stats.cpu += node.cpu.cores
					stats.memory += node.memory.total / 1024 / 1024 / 1024
					stats.memoryUsed += node.memory.used / 1024 / 1024 / 1024
				}

				return stats
			}
		},

		processNode: {
			description: "Add members to the addon",
			params: {
				nodeID: { type: "string", optional: false },
			},
			async handler(ctx) {
				const params = Object.assign({}, ctx.params);
				const nodeID = params.nodeID;//'triton.one-host.ca';

				const found = await this.findEntity(ctx, {
					query: {
						nodeID
					}
				});
				const heartbeat = await ctx.call('v1.node.heartbeat', {}, { nodeID }).catch(() => null)

				let entity;

				if (!found && heartbeat == null) {
					throw new MoleculerClientError("Invalid nodeID", 401, "INVALID_NODEID");
				}


				if (found && heartbeat == null) {
					if (found.online) {
						entity = await this.updateEntity(ctx, {
							online: false,
							id: found.id
						})
						ctx.emit('nodes.offline', entity);
					}
				} else if (!found) {
					entity = await this.createEntity(ctx, {
						...heartbeat,
						online: true,
						nodeID
					})




					ctx.emit('nodes.online', entity);
				} else {
					entity = await this.updateEntity(ctx, {
						...heartbeat,
						online: true,
						id: found.id
					})
					if (!found.online)
						ctx.emit('nodes.online', entity);
				}

				return entity
			}
		},

	},

	/**
	 * Events
	 */
	events: {
		async "apps.removed"(ctx) {
			const app = ctx.params.data;

		},
	},

	/**
	 * Methods
	 */
	methods: {

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
