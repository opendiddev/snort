import "./Layout.css";
import { useEffect } from "react";
import { useDispatch, useSelector } from "react-redux";
import { Outlet, useNavigate } from "react-router-dom";
import Envelope from "Icons/Envelope";
import Bell from "Icons/Bell";
import Search from "Icons/Search";

import { RootState } from "State/Store";
import { init, setRelays } from "State/Login";
import { System } from "Nostr/System";
import ProfileImage from "Element/ProfileImage";
import useLoginFeed from "Feed/LoginFeed";
import { totalUnread } from "Pages/MessagesPage";
import { SearchRelays, SnortPubKey } from "Const";
import useEventPublisher from "Feed/EventPublisher";
import useModeration from "Hooks/useModeration";
import { IndexedUDB, useDb } from "State/Users/Db";
import { db } from "Db";
import { bech32ToHex } from "Util";

export default function Layout() {
  const dispatch = useDispatch();
  const navigate = useNavigate();
  const { loggedOut, publicKey, relays, notifications, readNotifications, dms, preferences, newUserKey } = useSelector(
    (s: RootState) => s.login
  );
  const { isMuted } = useModeration();
  const filteredDms = dms.filter((a) => !isMuted(a.pubkey));
  const usingDb = useDb();
  const pub = useEventPublisher();
  useLoginFeed();

  useEffect(() => {
    System.nip42Auth = pub.nip42Auth;
  }, [pub]);

  useEffect(() => {
    System.UserDb = usingDb;
  }, [usingDb]);

  useEffect(() => {
    if (relays) {
      for (let [k, v] of Object.entries(relays)) {
        System.ConnectToRelay(k, v);
      }
      for (let [k, v] of System.Sockets) {
        if (!relays[k] && !SearchRelays.has(k)) {
          System.DisconnectRelay(k);
        }
      }
    }
  }, [relays]);

  function setTheme(theme: "light" | "dark") {
    const elm = document.documentElement;
    if (theme === "light" && !elm.classList.contains("light")) {
      elm.classList.add("light");
    } else if (theme === "dark" && elm.classList.contains("light")) {
      elm.classList.remove("light");
    }
  }

  useEffect(() => {
    let osTheme = window.matchMedia("(prefers-color-scheme: light)");
    setTheme(
      preferences.theme === "system" && osTheme.matches ? "light" : preferences.theme === "light" ? "light" : "dark"
    );

    osTheme.onchange = (e) => {
      if (preferences.theme === "system") {
        setTheme(e.matches ? "light" : "dark");
      }
    };
    return () => {
      osTheme.onchange = null;
    };
  }, [preferences.theme]);

  useEffect(() => {
    // check DB support then init
    IndexedUDB.isAvailable().then(async (a) => {
      const dbType = a ? "indexdDb" : "redux";

      // cleanup on load
      if (dbType === "indexdDb") {
        await db.feeds.clear();
        const now = Math.floor(new Date().getTime() / 1000);

        const cleanupEvents = await db.events
          .where("created_at")
          .above(now - 60 * 60)
          .primaryKeys();
        console.debug(`Cleanup ${cleanupEvents.length} events`);
        await db.events.bulkDelete(cleanupEvents);
      }

      console.debug(`Using db: ${dbType}`);
      dispatch(init(dbType));
    });
  }, []);

  async function handleNewUser() {
    try {
      let rsp = await fetch("https://api.nostr.watch/v1/online");
      if (rsp.ok) {
        let online: string[] = await rsp.json();
        let pickRandom = online.sort((a, b) => (Math.random() >= 0.5 ? 1 : -1)).slice(0, 4); // pick 4 random relays

        let relayObjects = pickRandom.map((a) => [a, { read: true, write: true }]);
        dispatch(
          setRelays({
            relays: Object.fromEntries(relayObjects),
            createdAt: 1,
          })
        );
      }
    } catch (e) {
      console.warn(e);
    }

    const ev = await pub.addFollow(bech32ToHex(SnortPubKey));
    pub.broadcast(ev);
  }

  useEffect(() => {
    if (newUserKey === true) {
      handleNewUser().catch(console.warn);
    }
  }, [newUserKey]);

  async function goToNotifications(e: any) {
    e.stopPropagation();
    // request permissions to send notifications
    if ("Notification" in window) {
      try {
        if (Notification.permission !== "granted") {
          let res = await Notification.requestPermission();
          console.debug(res);
        }
      } catch (e) {
        console.error(e);
      }
    }
    navigate("/notifications");
  }

  function accountHeader() {
    const unreadNotifications = notifications?.filter((a) => a.created_at * 1000 > readNotifications).length;
    const unreadDms = publicKey ? totalUnread(filteredDms, publicKey) : 0;
    return (
      <div className="header-actions">
        <div className="btn btn-rnd" onClick={(e) => navigate("/search")}>
          <Search />
        </div>
        <div className="btn btn-rnd" onClick={(e) => navigate("/messages")}>
          <Envelope />
          {unreadDms > 0 && <span className="has-unread"></span>}
        </div>
        <div className="btn btn-rnd" onClick={(e) => goToNotifications(e)}>
          <Bell />
          {unreadNotifications > 0 && <span className="has-unread"></span>}
        </div>
        <ProfileImage pubkey={publicKey || ""} showUsername={false} />
      </div>
    );
  }

  if (typeof loggedOut !== "boolean") {
    return null;
  }
  return (
    <div className="page">
      <header>
        <div className="logo" onClick={() => navigate("/")}>
          OpenDID
        </div>
        <div>
          {publicKey ? (
            accountHeader()
          ) : (
            <button type="button" onClick={() => navigate("/login")}>
              Login
            </button>
          )}
        </div>
      </header>

      <Outlet />
    </div>
  );
}
