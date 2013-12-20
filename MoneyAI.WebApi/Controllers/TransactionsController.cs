using System;
using System.Collections.Generic;
using System.Linq;
using System.Net;
using System.Net.Http;
using System.Web.Http;
using System.Text;

namespace MoneyAI.WebApi.Controllers
{
    public class TransactionsController : ApiController
    {
        // GET api/transactions
        public HttpResponseMessage Get()
        {
            var response = this.Request.CreateResponse(HttpStatusCode.OK);
            response.Content = new StringContent(Models.TransactionModel.GetSerializedJson("sytelus"), Encoding.UTF8, "application/json");
            return response;
        }
    }
}
