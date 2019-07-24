This is a node.js rpc proxy implementation with rabbitmq.

Docker Hub: [https://hub.docker.com/r/derek82511/node-rpc-proxy-rabbitmq](https://hub.docker.com/r/derek82511/node-rpc-proxy-rabbitmq)

GitHub: [https://github.com/derek82511/node-rpc-proxy-rabbitmq](https://github.com/derek82511/node-rpc-proxy-rabbitmq)

# Use Node.js
First, modify config/config-func.yaml, config/config-protocol.yaml according to your rpc infos.

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
  -v [path to your func config folder]:/app/config \
  --name node-rpc-proxy-rabbitmq \
  derek82511/node-rpc-proxy-rabbitmq:latest
```

# Testing

```console
curl -X POST \
  'http://localhost:3000/rpc?func=[your func]' \
  -H 'content-type: application/json' \
  -d '{ "foo": "bar" }'
```
