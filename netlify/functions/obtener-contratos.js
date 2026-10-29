const { getStore } = require("@netlify/blobs");

/**
 * Netlify Function: obtener-contratos
 * Endpoint para recuperar contratos almacenados en Netlify Blobs.
 * Método permitido: GET
 */
exports.handler = async (event, context) => {
    if (event.httpMethod !== 'GET') {
        return {
            statusCode: 405,
            headers: {
                'Content-Type': 'application/json',
                'Allow': 'GET'
            },
            body: JSON.stringify({
                error: 'Method Not Allowed',
                message: 'Este endpoint únicamente acepta solicitudes GET.'
            })
        };
    }

    try {
        const store = getStore("contratos");
        const queryParams = event.queryStringParameters || {};
        const requestedId = queryParams.id;

        // Si se solicita un contrato específico por ID
        if (requestedId) {
            const contract = await store.get(requestedId, { type: 'json' });
            if (!contract) {
                return {
                    statusCode: 404,
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({
                        error: 'Not Found',
                        message: `No se encontró el contrato con ID: ${requestedId}`
                    })
                };
            }

            return {
                statusCode: 200,
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    success: true,
                    data: contract
                })
            };
        }

        // Si se solicitan todos los contratos
        const { blobs } = await store.list();
        const contracts = {};

        for (const item of blobs) {
            try {
                const data = await store.get(item.key, { type: 'json' });
                if (data && data.id) {
                    contracts[data.id] = data;
                }
            } catch (err) {
                console.warn(`No se pudo leer el blob para la clave ${item.key}:`, err);
            }
        }

        return {
            statusCode: 200,
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                success: true,
                contracts: contracts,
                total: Object.keys(contracts).length
            })
        };
    } catch (error) {
        console.error("Error en Netlify Function (obtener-contratos):", error);
        return {
            statusCode: 500,
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                error: 'Internal Server Error',
                message: 'Ocurrió un error al consultar Netlify Blobs.',
                details: error.message
            })
        };
    }
};
