import axios from 'axios';

module.exports = async function () {
  const host = process.env.API_HOST ?? 'localhost';
  const port = process.env.PORT ?? '3333';
  const prefix = process.env.API_GLOBAL_PREFIX ?? 'api';
  axios.defaults.baseURL = `http://${host}:${port}/${prefix}`;
  // Don't throw on 4xx - the tests assert on status codes themselves.
  axios.defaults.validateStatus = () => true;
};
