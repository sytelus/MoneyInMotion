using System;
using System.Collections.Generic;
using System.Linq;
using System.Net;
using System.Net.Http;
using System.Text;
using System.Web;

namespace MoneyAI.WebApi.Common
{
    public static class WebUtils
    {
        public static HttpResponseMessage GetJsonResponse(this HttpRequestMessage request, string json)
        {
            var response = request.CreateResponse(HttpStatusCode.OK);
            response.Content = new StringContent(json, Encoding.UTF8, "application/json");
            return response;
        }
    }
}