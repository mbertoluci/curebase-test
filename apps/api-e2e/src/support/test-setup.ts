import axios from 'axios';
import { e2eApiTarget } from './e2e-env';

module.exports = async function () {
  const { host, port } = e2eApiTarget();
  const prefix = process.env.API_GLOBAL_PREFIX ?? 'api';
  axios.defaults.baseURL = `http://${host}:${port}/${prefix}`;
  // Don't throw on 4xx - the tests assert on status codes themselves.
  axios.defaults.validateStatus = () => true;
};
