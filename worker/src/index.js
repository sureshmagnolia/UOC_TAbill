export default {
	async fetch(request, env, ctx) {
		const url = new URL(request.url);
		const path = url.pathname;

		// CORS setup
		const corsHeaders = {
			'Access-Control-Allow-Origin': '*',
			'Access-Control-Allow-Methods': 'GET,HEAD,POST,OPTIONS',
			'Access-Control-Max-Age': '86400',
			'Content-Type': 'application/json'
		};

		if (request.method === 'OPTIONS') {
			return new Response(null, { headers: corsHeaders });
		}

		try {
			if (path === '/api/stations') {
				const legsStr = await env.TA_DATA.get('legs');
				if (!legsStr) return new Response('[]', { headers: corsHeaders });
				const legsData = JSON.parse(legsStr);
				return new Response(JSON.stringify(legsData.stations || []), { headers: corsHeaders });
			}
			
			if (path === '/api/leg') {
				const from = url.searchParams.get('from');
				const to = url.searchParams.get('to');
				if (!from || !to) return new Response('null', { headers: corsHeaders });
				
				const legsStr = await env.TA_DATA.get('legs');
				const legsData = JSON.parse(legsStr);
				
				// Find leg
				let foundLeg = null;
				if (legsData && legsData.legs) {
					for (const arr of Object.values(legsData.legs)) {
						const f = legsData.stations[arr[0]];
						const t = legsData.stations[arr[1]];
						if ((f === from && t === to) || (f === to && t === from)) {
							foundLeg = {
								From: f,
								To: t,
								Mode: legsData.modes[arr[2]],
								KM: arr[3],
								Type: legsData.types[arr[4]],
								...(arr[5] !== undefined && arr[5] !== null ? { Fare: arr[5] } : {})
							};
							break;
						}
					}
				}
				return new Response(JSON.stringify(foundLeg), { headers: corsHeaders });
			}

			if (path === '/api/route') {
				const fromCollege = url.searchParams.get('fromCollege');
				const toCollege = url.searchParams.get('toCollege');
				
				const routeStr = await env.TA_DATA.get('routes:' + fromCollege);
				if (!routeStr) return new Response('[]', { headers: corsHeaders });
				
				const routeData = JSON.parse(routeStr);
				const legIds = routeData[`${fromCollege}_${toCollege}`];
				if (!legIds || legIds.length === 0) return new Response('[]', { headers: corsHeaders });
				
				const legsStr = await env.TA_DATA.get('legs');
				const legsData = JSON.parse(legsStr);
				
				const resolvedLegs = legIds.map(id => {
					const arr = legsData.legs[id];
					if (!arr) return null;
					return {
						From: legsData.stations[arr[0]],
						To: legsData.stations[arr[1]],
						Mode: legsData.modes[arr[2]],
						KM: arr[3],
						Type: legsData.types[arr[4]],
						...(arr[5] !== undefined && arr[5] !== null ? { Fare: arr[5] } : {})
					};
				}).filter(Boolean);
				
				return new Response(JSON.stringify(resolvedLegs), { headers: corsHeaders });
			}

			return new Response('API endpoint not found', { status: 404, headers: corsHeaders });
		} catch (e) {
			return new Response(e.message, { status: 500, headers: corsHeaders });
		}
	},
};
