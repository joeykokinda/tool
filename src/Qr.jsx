import { useEffect, useRef, useState } from "react";
import QRCodeStyling from "qr-code-styling";
import { Field, Check } from "./ui.jsx";

const dotStyles = ["square", "rounded", "dots", "classy", "classy-rounded", "extra-rounded"];
const cornerStyles = ["square", "extra-rounded", "dot"];

const escapeWifi = (text) => text.replace(/([\\;,:"])/g, "\\$1");

function buildData(mode, values) {
  if (mode === "wifi")
    return `WIFI:T:${values.wifiSecurity};S:${escapeWifi(values.wifiName)};${
      values.wifiSecurity === "nopass" ? "" : `P:${escapeWifi(values.wifiPassword)};`
    }${values.wifiHidden ? "H:true;" : ""};`;
  if (mode === "email") {
    const query = new URLSearchParams();
    if (values.emailSubject) query.set("subject", values.emailSubject);
    if (values.emailBody) query.set("body", values.emailBody);
    const suffix = query.toString().replace(/\+/g, "%20");
    return `mailto:${values.emailTo}${suffix ? "?" + suffix : ""}`;
  }
  if (mode === "link" && values.link && !/^[a-z][a-z0-9+.-]*:/i.test(values.link)) return "https://" + values.link;
  return mode === "link" ? values.link : values.text;
}

export default function Qr() {
  const [mode, setMode] = useState("link");
  const [values, setValues] = useState({
    link: "https://jkokinda.com",
    text: "",
    wifiName: "",
    wifiPassword: "",
    wifiSecurity: "WPA",
    wifiHidden: false,
    emailTo: "",
    emailSubject: "",
    emailBody: "",
  });
  const [style, setStyle] = useState({
    size: 1024,
    margin: 4,
    foreground: "#26331f",
    background: "#ffffff",
    transparent: false,
    dots: "rounded",
    corners: "extra-rounded",
    correction: "M",
    logo: "",
    logoSize: 0.3,
    logoMargin: 8,
  });
  const [error, setError] = useState("");
  const previewRef = useRef(null);
  const qrRef = useRef(null);

  const setValue = (key) => (event) =>
    setValues((previous) => ({ ...previous, [key]: event.target.type === "checkbox" ? event.target.checked : event.target.value }));
  const setStyleKey = (key, transform = (value) => value) => (event) =>
    setStyle((previous) => ({ ...previous, [key]: transform(event.target.value) }));

  const data = buildData(mode, values);

  useEffect(() => {
    const options = {
      type: "svg",
      width: style.size,
      height: style.size,
      // margin is in quiet-zone modules, the library wants pixels; ~33 modules is a typical code
      margin: Math.round((style.margin * style.size) / 41),
      data: data || " ",
      image: style.logo || undefined,
      // a logo covers modules, so it needs the highest error correction to stay scannable
      qrOptions: { errorCorrectionLevel: style.logo ? "H" : style.correction },
      dotsOptions: { type: style.dots, color: style.foreground },
      cornersSquareOptions: { type: style.corners, color: style.foreground },
      cornersDotOptions: { type: style.corners === "dot" ? "dot" : "square", color: style.foreground },
      backgroundOptions: { color: style.transparent ? "transparent" : style.background },
      imageOptions: { hideBackgroundDots: true, imageSize: style.logoSize, margin: style.logoMargin },
    };
    try {
      if (!qrRef.current) {
        qrRef.current = new QRCodeStyling(options);
        qrRef.current.append(previewRef.current);
      } else qrRef.current.update(options);
      setError("");
    } catch (caught) {
      setError(/overflow|too (long|big)/i.test(String(caught)) ? "Too much data for one QR code." : String(caught.message || caught));
    }
  }, [data, style]);

  const loadLogo = (event) => {
    const file = event.target.files[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = () => setStyle((previous) => ({ ...previous, logo: reader.result }));
    reader.readAsDataURL(file);
  };

  const download = (extension) => qrRef.current.download({ name: "qr", extension });
  const copyImage = async () => {
    const blob = await qrRef.current.getRawData("png");
    await navigator.clipboard.write([new ClipboardItem({ "image/png": blob })]);
  };

  return (
    <div className="split">
      <div>
        <div className="tabs">
          {["link", "text", "wifi", "email"].map((name) => (
            <button key={name} type="button" className={mode === name ? "active" : ""} onClick={() => setMode(name)}>
              {name}
            </button>
          ))}
        </div>

        <div className="grid">
          {mode === "link" && (
            <Field label="Link" wide>
              <input value={values.link} onChange={setValue("link")} placeholder="https://" autoFocus />
            </Field>
          )}
          {mode === "text" && (
            <Field label="Text" wide>
              <textarea rows={4} value={values.text} onChange={setValue("text")} />
            </Field>
          )}
          {mode === "wifi" && (
            <>
              <Field label="Network name">
                <input value={values.wifiName} onChange={setValue("wifiName")} />
              </Field>
              <Field label="Password">
                <input value={values.wifiPassword} onChange={setValue("wifiPassword")} />
              </Field>
              <Field label="Security">
                <select value={values.wifiSecurity} onChange={setValue("wifiSecurity")}>
                  <option value="WPA">WPA / WPA2 / WPA3</option>
                  <option value="WEP">WEP</option>
                  <option value="nopass">None</option>
                </select>
              </Field>
              <label className="check">
                <input type="checkbox" checked={values.wifiHidden} onChange={setValue("wifiHidden")} />
                Hidden network
              </label>
            </>
          )}
          {mode === "email" && (
            <>
              <Field label="To">
                <input type="email" value={values.emailTo} onChange={setValue("emailTo")} />
              </Field>
              <Field label="Subject">
                <input value={values.emailSubject} onChange={setValue("emailSubject")} />
              </Field>
              <Field label="Body" wide>
                <textarea rows={3} value={values.emailBody} onChange={setValue("emailBody")} />
              </Field>
            </>
          )}
        </div>

        <h3>Logo</h3>
        <div className="grid">
          <Field label="Image in the middle">
            <input type="file" accept="image/*" onChange={loadLogo} />
          </Field>
          {style.logo && (
            <>
              <Field label={`Logo size ${Math.round(style.logoSize * 100)}%`}>
                <input type="range" min="0.15" max="0.45" step="0.01" value={style.logoSize} onChange={setStyleKey("logoSize", Number)} />
              </Field>
              <Field label={`Logo padding ${style.logoMargin}px`}>
                <input type="range" min="0" max="40" value={style.logoMargin} onChange={setStyleKey("logoMargin", Number)} />
              </Field>
              <button type="button" className="small" onClick={() => setStyle((previous) => ({ ...previous, logo: "" }))}>
                Remove logo
              </button>
            </>
          )}
        </div>

        <h3>Style</h3>
        <div className="grid">
          <Field label="Dots">
            <select value={style.dots} onChange={setStyleKey("dots")}>
              {dotStyles.map((name) => (
                <option key={name}>{name}</option>
              ))}
            </select>
          </Field>
          <Field label="Corners">
            <select value={style.corners} onChange={setStyleKey("corners")}>
              {cornerStyles.map((name) => (
                <option key={name}>{name}</option>
              ))}
            </select>
          </Field>
          <Field label="Color">
            <input type="color" value={style.foreground} onChange={setStyleKey("foreground")} />
          </Field>
          <Field label="Background">
            <input type="color" value={style.background} onChange={setStyleKey("background")} disabled={style.transparent} />
          </Field>
          <Check label="Transparent background" checked={style.transparent} onChange={(transparent) => setStyle((previous) => ({ ...previous, transparent }))} />
          <Field label={`Quiet zone ${style.margin}`}>
            <input type="range" min="0" max="8" value={style.margin} onChange={setStyleKey("margin", Number)} />
          </Field>
          <Field label="Error correction">
            <select value={style.logo ? "H" : style.correction} onChange={setStyleKey("correction")} disabled={Boolean(style.logo)}>
              <option value="L">L (7%)</option>
              <option value="M">M (15%)</option>
              <option value="Q">Q (25%)</option>
              <option value="H">H (30%)</option>
            </select>
          </Field>
          <Field label="Export size">
            <select value={style.size} onChange={setStyleKey("size", Number)}>
              {[512, 1024, 2048, 4096].map((size) => (
                <option key={size} value={size}>
                  {size} px
                </option>
              ))}
            </select>
          </Field>
        </div>
      </div>

      <div className="qr-side">
        <div className="qr-preview" ref={previewRef} />
        {error && <p className="error">{error}</p>}
        <div className="row">
          <button type="button" onClick={() => download("png")}>
            PNG
          </button>
          <button type="button" onClick={() => download("svg")}>
            SVG
          </button>
          <button type="button" onClick={copyImage}>
            Copy image
          </button>
        </div>
        <code className="qr-data">{data}</code>
      </div>
    </div>
  );
}
