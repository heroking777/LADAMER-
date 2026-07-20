"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const express_1 = __importDefault(require("express"));
const router = express_1.default.Router();
router.get('/', (req, res) => {
    res.json({ calls: [{ id: '1', status: 'active', duration: 120 }] });
});
router.get('/:id', (req, res) => {
    res.json({ id: req.params.id, status: 'active' });
});
exports.default = router;
