This is a node.js fastify api proxy which implements rpc client to rabbitmq.

Docker Hub: [https://hub.docker.com/r/derek82511/node-rpc-proxy-rabbitmq](https://hub.docker.com/r/derek82511/node-rpc-proxy-rabbitmq)

GitHub: [https://github.com/derek82511/node-rpc-proxy-rabbitmq](https://github.com/derek82511/node-rpc-proxy-rabbitmq)

# Use Node.js
First, modify config/config-func.yaml according to your rpc infos.

```console
npm install

npm start

curl -X POST \
  'http://localhost:3000/rpc?func=[your func]' \
  -H 'content-type: application/json' \
  -d '{ "foo": "bar" }'
```

# Use Docker

```console
docker run -it \
  -p 3000:3000 \
  -e "TZ=Asia/Taipei" \
  -v [path to your func config yaml]:/app/config/config-func.yaml \
  --name node-rpc-proxy-rabbitmq \
  derek82511/node-rpc-proxy-rabbitmq:1.1.0
```

# Testing

```console
curl -X POST \
  'http://localhost:3000/rpc?func=[your func]' \
  -H 'content-type: application/json' \
  -d '{ "foo": "bar" }'
```
