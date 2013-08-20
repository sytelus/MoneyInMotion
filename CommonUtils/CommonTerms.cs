﻿using System;
using System.Collections.Generic;
using System.Linq;
using System.Text;

namespace CommonUtils
{
    internal static class CommonTerms
    {
        public static readonly HashSet<string> CommonHostPrefixes = new HashSet<string>(new string[] {
        "www", "stores", "on", "maps", "web", "store", "shop", "spa", "site", "sites", "tutoring", "www1", "www2", "austin", "classes", "embassysuites1", "school", "auduboninn", "chicago", "corp", "dealers", "events", "hamptoninn", "local", "movies", "mysite", "newyork", "order", "panthers", "shreveport", "sl-si", "thesundevils"
        });

        public static readonly HashSet<string> CommonPaths = new HashSet<string>(new string[] {
        "pages", "home", "site", "biz", "golf", "sports", "locations", "proto", "store", "hotels", "index.php", "spa", "en", "events", "index", "maps", "html", "m-baskbl", "restaurant", "dining", "page", "sites", "en-us", "main", "place", "clubs", "view", "content", "tabid", "groupon", "menu", "about", "us", "shop", "learningcenters", "stores", "courses", "cgi-bin", "restaurants", "entertainment", "party-places-for-kids", "people", "r", "hotel", "event", "welcome", "en_us", "services", "profile", "shows", "ordereze", "blog", "wordpress", "live", "scripts", "club", "info", "web", "location", "new", "chicago", "bootcamp", "hoteldetail", "dleague", "2010", "tickets", "miami", "fresno", "tours", "visit", "node", "usa", "article", "tx", "austin", "catalog", "index.cfm", "property", "gallery", "11", "gyms", "jacksonville", "wp", "pittsburgh", "zgrid", "themes", "in", "salons", "36", "centers", "healthandbeauty", "seattle", "landing", "lubbock-tx", "trainerfinder", "websites", "milwaukee", "travel", "clients", "california", "lasvegas", "pc", "hyatt", "salem-or", "search", "oh", "houston", "es", "intro", "hp", "www", "florida", "show", "al", "_minisites", "homepage", "cincinnati", "1", "about-us", "storelocator", "portal", "contact", "m-footbl", "dance", "dine", "massage", "nc", "clientmanager", "bistro", "ohio", "atlanta", "phoenix", "sanjose", "recreation", "corpus-christi-tx", "bakersfield-ca", "storelocations", "deals", "casinos", "comedyclub", "retailer", "store_templates", "hotel-information", "chapters", "cafe", "hi", "directory", "find-a-tuffy", "cart", "mip", "rockford", "dnn", "lessons", "cms", "show-info", "roanoke", "custom_content", "sc", "billings", "knoxville", "li", "coppermillgolf", "salem", "label", "greensboro-nc", "p", "tianjin", "kennesaw", "education", "contact-us", "details", "williamsburg", "norwalk", "category", "media", "lexington", "memphis", "movies", "elpaso", "parks", "evansville", "api", "spa-botanica", "joomla", "columbus", "tampa", "bridalextravaganza", "harmony grill", "resources", "shops", "website", "webobjects", "pwda.woa", "wa", "loadpage", "dev", "qstore", "sugarloaf", "omaha", "detail", "mystore", "nowplaying", "169", "xe", "door", "cms_pages", "indy", "control", "montgomery", "ks", "bmseweb", "kentucky", "new-york", "classes", "sanfrancisco", "component", "cc", "erie", "kansascity", "default", "richmond", "pricing", "tour", "programs", "performances", "dept", "festival", "go", "stlpa", "aboutus", "lincoln-ne", "tulsa-ok", "baton-rouge-la", "georges-restaurant", "159544957391345", "lidos-the-euro-spot", "158592460835247", "kalamazoo-mi", "little-rock-ar", "mcallen-tx", "odessa-tx", "zambies", "172351532776434", "wichita-ks", "guestservices", "washington", "fantasticsams", "consumer", "theater", "wi", "customer", "2011", "public", "gaylord-opryland", "tan", "amenities", "mcallentx", "w-baskbl", "rr", "arizona", "calendar", "hotel-casino", "mainsite", "corpus-christi", "pdino", "cmshaa", "academy", "fortwayne", "b", "cmstest", "j", "mbkb", "food", "v2", "10-11_season", "center", "menus", "school", "wichita", "ctn", "idaho", "kings", "wellness-center", "findahotel", "autoshow", "louisville", "san-antonio", "alehouses", "about_us", "microsite", "corporate", "fourpoints", "sheraton", "infostore", "46", "oklahoma-city"
        });

        public static readonly HashSet<string> CommonFileParts = new HashSet<string>(new string[] {
        "html", "index", "php", "htm", "aspx", "default", "home", "asp", "cfm", "home_page", "welcome", "shtml", "index2", "main", "jsp", "about", "profile", "contact", "group", "homepage", "nxg", "page", "menu", "locations", "aboutus", "services", "do", "groupon", "generalinfo", "restaurant", "layout9", "jumpzone_home", "bok", "index1", "spa", "index_main", "store_page", "events", "storefront", "splash", "1", "schedule", "location", "store", "dining", "jhtml", "sportselect", "dbml", "details", "index-main", "content", "cgi", "page2", "info", "search", "storedetail", "about-us", "menus", "reviews", "testimonials", "intro", "classes", "shell_id_1", "pdf", "main_school", "front", "default2", "map", "chicago", "shtm", "eventdetails", "action", "tickets", "sb", "cn", "massage", "indexb", "taf", "1frame", "education", "studio", "eventhome", "press", "golf", "rates", "packages", "spa_services", "salon", "property-home", "procedures", "contact-us", "rest", "flash", "about_us", "season", "exhibitor_showlisting", "ivnu", "index_higher_flash"
        });

        [Obsolete]
        public static readonly HashSet<string> includePathExceptionHosts = new HashSet<string>(new string[] { "facebook.com", "bit.ly", "gr.pn", "yelp.com", "fb.me", "urbanspoon.com", "myspace.com", "google.com", "me.com", "judysbook.com", "urlformatexception", "yahoo.com", "citysearch.com", "yelp.com", "insiderpages.com", "doubleclick.net", "bbb.org", "kudzu.com", "menuism.com", "mac.com", "bing.com", "wix.com", "allmenus.com" });

        public static readonly HashSet<string> includeQueryParameterExceptionNames = new HashSet<string>(new string[] { "id", "llr", "cl", "oeidk", "q", "salonid", "cid", "gid", "biz", "companyid", "memberid", "fbid", "wizard", "accid", "merchantid", "realmid", "artistid", "tid", "est_id" });

        [Obsolete]
        public static readonly HashSet<string> includeHostPrefixForHostBases = new HashSet<string>(new string[] { "blogspot.com", "webs.com", "vpweb.com", "massagetherapy.com", "officelive.com", "wordpress.com", "weebly.com", "cstv.com", "pointstreaksites.com", "citysearch.com", "facebook.com", "yolasite.com", "comcastbiz.net", "abmp.com", "squarespace.com", "intuitwebsites.com", "homestead.com", "mlb.com", "arizona.edu", "tropicalsmoothie.com", "google.com", "ning.com", "us.com", "netsolhost.com", "yahoo.com", "co.uk", "co.kr", "tumblr.com", "multiply.com", "tripod.com", "jimdo.com", "zvents.com", "bing.com" });

        [Obsolete]
        public static readonly HashSet<string> includeFileForHostBases = new HashSet<string>(new string[] { "yellowbook.com", "yellowpages.com", "associatedcontent.com" });

    }
}
