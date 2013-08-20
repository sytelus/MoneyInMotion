using System;
using System.Collections.Concurrent;
using System.Collections.Generic;
using System.Linq;
using System.Text;
using System.Threading.Tasks;

namespace CommonUtils
{
    public static class MessagePipe<TListnerKey, TChannel, TMessage> where TChannel : IComparable
    {
        private class Listner
        {
            public TChannel Channel { get; set; }
            public Func<TMessage, bool> Callback { get; set; }
        }

        private static readonly ConcurrentDictionary<TListnerKey, Listner> listeners = new ConcurrentDictionary<TListnerKey, Listner>();
        public static bool AddListner(TListnerKey listnerKey, Func<TMessage, bool> callback, TChannel channel = default(TChannel))
        {
            return listeners.TryAdd(listnerKey, new Listner() {Channel = channel, Callback = callback});
        }

        public static void SendMessage(TMessage message, TChannel channel = default(TChannel))
        {
            foreach (var listener in listeners.Values.Where(l => l.Channel.CompareTo(channel) == 0))
            {
                if (!listener.Callback(message))
                    break;
            }
        }

        public static bool RemoveListner(TListnerKey listnerKey)
        {
            Listner listner;
            return listeners.TryRemove(listnerKey, out listner);
        }
    }
}
