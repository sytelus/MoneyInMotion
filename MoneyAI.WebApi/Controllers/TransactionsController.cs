using System;
using System.Collections.Generic;
using System.Linq;
using System.Net;
using System.Net.Http;
using System.Web.Http;
using System.Text;
using MoneyAI.WebApi.Common;

namespace MoneyAI.WebApi.Controllers
{
    public class TransactionsController : ApiController
    {
        // GET api/transactions
        public HttpResponseMessage Get()
        {
            return this.Request.GetJsonResponse(Models.TransactionModel.GetSerializedJson("sytelus"));
        }
    }
}
