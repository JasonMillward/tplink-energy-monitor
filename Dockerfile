FROM node:8-alpine
RUN apk add --no-cache tzdata
ENV TZ="Australia/Adelaide"
RUN cp /usr/share/zoneinfo/Australia/Adelaide /etc/localtime
RUN echo "Australia/Adelaide" > /etc/timezone
WORKDIR /opt/tplink-monitor
COPY . .
RUN npm install
EXPOSE 3000
CMD ["npm", "start"]
