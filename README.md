# Who Is Who

[![PHPUnit](https://github.com/skjnldsv/whoiswho/workflows/PHPUnit/badge.svg)](https://github.com/skjnldsv/whoiswho/actions?query=workflow%3APHPUnit)
[![Node](https://github.com/skjnldsv/whoiswho/workflows/Node/badge.svg)](https://github.com/skjnldsv/whoiswho/actions?query=workflow%3ANode)
[![Lint](https://github.com/skjnldsv/whoiswho/workflows/Lint/badge.svg)](https://github.com/skjnldsv/whoiswho/actions?query=workflow%3ALint)

A Nextcloud app for managing and displaying user information.

---

## Installation

Navigate to your Nextcloud apps directory:

```bash
cd nextcloud/apps
```

Clone this repository into a folder named **whoiswho**¹:

```bash
git clone https://github.com/skjnldsv/whoiswho.git whoiswho
```

Install backend dependencies:

```bash
make composer
```

¹ *The directory name must match the app ID defined in `appinfo/info.xml`.*

---

## Development

### Frontend

The frontend is built with [Vue.js](https://vuejs.org/).

**Setup:**

```bash
make dev-setup
```

**Build:**

```bash
make build-js
```

**Watch mode** (auto-rebuild on file changes):

```bash
make watch-js
```

---

## License

See [LICENSE](LICENSE) for details.
