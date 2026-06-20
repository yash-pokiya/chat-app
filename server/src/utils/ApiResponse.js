class ApiResponse {
  constructor(statusCode, data, message = 'Success') {
    this.statusCode = statusCode;
    this.success = statusCode < 400;
    this.message = message;

    if (data !== undefined && data !== null) {
      let rawData = data;
      if (typeof data.toObject === 'function') {
        rawData = data.toObject();
      }

      if (typeof rawData === 'object' && !Array.isArray(rawData) && !(rawData instanceof Date)) {
        Object.assign(this, rawData);
      } else {
        this.data = rawData;
      }
    }
  }
}

module.exports = ApiResponse;

