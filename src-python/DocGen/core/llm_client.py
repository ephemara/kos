"""
LLM API Client for DocGen System

This module provides a unified interface for LLM API providers (OpenRouter and Gemini)
with automatic rate limiting, retry logic with exponential backoff, and cost tracking.

Features:
- OpenRouter API integration (supports Claude, GPT-4, etc.)
- Google Gemini API integration
- Exponential backoff retry logic (1s, 2s, 4s, 8s, 16s)
- Token usage and cost estimation
- Async HTTP requests with aiohttp
"""

import os
import asyncio
import logging
from dataclasses import dataclass
from typing import Optional, Dict, Any
import aiohttp
from pathlib import Path

logger = logging.getLogger(__name__)


@dataclass
class LLMResponse:
    """
    Response from an LLM API call.
    
    Attributes:
        content: The generated text content
        prompt_tokens: Number of tokens in the prompt
        completion_tokens: Number of tokens in the completion
        model: The model used for generation
        cost_usd: Estimated cost in USD
    """
    content: str
    prompt_tokens: int
    completion_tokens: int
    model: str
    cost_usd: float


class LLMClient:
    """
    Unified LLM API client supporting OpenRouter and Gemini.
    
    Handles rate limiting with exponential backoff, cost tracking, and
    provides a consistent interface across different providers.
    
    Attributes:
        provider: API provider ('openrouter' or 'gemini')
        model: Model identifier (e.g., 'anthropic/claude-3.5-sonnet')
        api_key: API key for authentication
        max_tokens: Maximum tokens in completion
        temperature: Sampling temperature (0.0 to 1.0)
        pricing: Token pricing configuration
    """
    
    # API endpoints
    OPENROUTER_API_URL = "https://openrouter.ai/api/v1/chat/completions"
    GEMINI_API_URL = "https://generativelanguage.googleapis.com/v1beta/models/{model}:generateContent"
    
    # Retry configuration
    MAX_RETRIES = 5
    RETRY_DELAYS = [1, 2, 4, 8, 16]  # Exponential backoff in seconds
    
    def __init__(
        self,
        provider: str,
        model: str,
        api_key: str,
        max_tokens: int = 4000,
        temperature: float = 0.3,
        pricing: Optional[Dict[str, int]] = None
    ):
        """
        Initialize the LLM client.
        
        Args:
            provider: API provider ('openrouter' or 'gemini')
            model: Model identifier
            api_key: API key for authentication
            max_tokens: Maximum tokens in completion (default: 4000)
            temperature: Sampling temperature (default: 0.3)
            pricing: Token pricing dict with 'prompt_tokens_per_dollar' and
                    'completion_tokens_per_dollar' keys
        
        Raises:
            ValueError: If provider is not supported
        """
        if provider not in ['openrouter', 'gemini']:
            raise ValueError(f"Unsupported provider: {provider}. Must be 'openrouter' or 'gemini'")
        
        self.provider = provider
        self.model = model
        self.api_key = api_key
        self.max_tokens = max_tokens
        self.temperature = temperature
        
        # Default pricing (tokens per dollar)
        self.pricing = pricing or {
            'prompt_tokens_per_dollar': 3333333,  # ~$0.30 per 1M tokens
            'completion_tokens_per_dollar': 666666  # ~$1.50 per 1M tokens
        }
        
        # Usage tracking
        self.total_prompt_tokens = 0
        self.total_completion_tokens = 0
        self.total_cost_usd = 0.0
        self.request_count = 0
        self._last_response_cost = 0.0  # Track last response cost for parallel processing
        
        logger.info(f"LLMClient initialized: provider={provider}, model={model}")
    
    @classmethod
    def from_config(cls, config: Dict[str, Any], api_key: Optional[str] = None) -> 'LLMClient':
        """
        Create LLMClient from configuration dictionary.
        
        Args:
            config: Configuration dict (typically from docgen_config.json)
            api_key: Optional API key override (otherwise loads from env)
        
        Returns:
            Configured LLMClient instance
        
        Raises:
            ValueError: If API key not found
        """
        provider = config.get('provider', 'openrouter')
        model = config.get('model', 'anthropic/claude-3.5-sonnet')
        max_tokens = config.get('max_tokens', 4000)
        temperature = config.get('temperature', 0.3)
        pricing = config.get('pricing')
        
        # Load API key from environment if not provided
        if api_key is None:
            api_key_env = config.get('api_key_env', 'OPENROUTER_API_KEY')
            api_key = os.getenv(api_key_env)
            
            if not api_key:
                raise ValueError(
                    f"API key not found. Set {api_key_env} environment variable "
                    f"or pass api_key parameter"
                )
        
        return cls(
            provider=provider,
            model=model,
            api_key=api_key,
            max_tokens=max_tokens,
            temperature=temperature,
            pricing=pricing
        )
    
    async def generate(
        self,
        system_prompt: str,
        user_prompt: str,
        max_tokens: Optional[int] = None
    ) -> LLMResponse:
        """
        Generate completion from LLM.
        
        Automatically handles rate limiting with exponential backoff retry logic.
        
        Args:
            system_prompt: System prompt defining agent role and constraints
            user_prompt: User prompt with specific task/question
            max_tokens: Override default max_tokens for this request
        
        Returns:
            LLMResponse with generated content and usage statistics
        
        Raises:
            aiohttp.ClientError: If all retries fail
        """
        max_tokens = max_tokens or self.max_tokens
        
        # Retry with exponential backoff
        for attempt in range(self.MAX_RETRIES):
            try:
                if self.provider == 'openrouter':
                    response = await self._generate_openrouter(
                        system_prompt, user_prompt, max_tokens
                    )
                else:  # gemini
                    response = await self._generate_gemini(
                        system_prompt, user_prompt, max_tokens
                    )
                
                # Update usage statistics
                self.total_prompt_tokens += response.prompt_tokens
                self.total_completion_tokens += response.completion_tokens
                self.total_cost_usd += response.cost_usd
                self.request_count += 1
                self._last_response_cost = response.cost_usd  # Track for parallel processing
                
                logger.info(
                    f"LLM request successful: {response.prompt_tokens} prompt tokens, "
                    f"{response.completion_tokens} completion tokens, "
                    f"${response.cost_usd:.4f}"
                )
                
                return response
            
            except aiohttp.ClientError as e:
                if attempt < self.MAX_RETRIES - 1:
                    delay = self.RETRY_DELAYS[attempt]
                    logger.warning(
                        f"LLM request failed (attempt {attempt + 1}/{self.MAX_RETRIES}): {e}. "
                        f"Retrying in {delay}s..."
                    )
                    await asyncio.sleep(delay)
                else:
                    logger.error(f"LLM request failed after {self.MAX_RETRIES} attempts: {e}")
                    raise
    
    async def _generate_openrouter(
        self,
        system_prompt: str,
        user_prompt: str,
        max_tokens: int
    ) -> LLMResponse:
        """
        Generate completion using OpenRouter API.
        
        Args:
            system_prompt: System prompt
            user_prompt: User prompt
            max_tokens: Maximum completion tokens
        
        Returns:
            LLMResponse
        """
        headers = {
            'Authorization': f'Bearer {self.api_key}',
            'Content-Type': 'application/json',
            'HTTP-Referer': 'https://github.com/K_OS',  # Optional but recommended
        }
        
        payload = {
            'model': self.model,
            'messages': [
                {'role': 'system', 'content': system_prompt},
                {'role': 'user', 'content': user_prompt}
            ],
            'max_tokens': max_tokens,
            'temperature': self.temperature
        }
        
        async with aiohttp.ClientSession() as session:
            async with session.post(
                self.OPENROUTER_API_URL,
                headers=headers,
                json=payload
            ) as response:
                response.raise_for_status()
                data = await response.json()
        
        # Extract response data
        content = data['choices'][0]['message']['content']
        usage = data['usage']
        prompt_tokens = usage['prompt_tokens']
        completion_tokens = usage['completion_tokens']
        
        # Estimate cost
        cost_usd = self.estimate_cost(prompt_tokens, completion_tokens)
        
        return LLMResponse(
            content=content,
            prompt_tokens=prompt_tokens,
            completion_tokens=completion_tokens,
            model=self.model,
            cost_usd=cost_usd
        )
    
    async def _generate_gemini(
        self,
        system_prompt: str,
        user_prompt: str,
        max_tokens: int
    ) -> LLMResponse:
        """
        Generate completion using Google Gemini API.
        
        Args:
            system_prompt: System prompt
            user_prompt: User prompt
            max_tokens: Maximum completion tokens
        
        Returns:
            LLMResponse
        """
        # Gemini API URL with model
        url = self.GEMINI_API_URL.format(model=self.model)
        url += f"?key={self.api_key}"
        
        headers = {
            'Content-Type': 'application/json'
        }
        
        # Gemini combines system and user prompts
        combined_prompt = f"{system_prompt}\n\n{user_prompt}"
        
        payload = {
            'contents': [{
                'parts': [{'text': combined_prompt}]
            }],
            'generationConfig': {
                'maxOutputTokens': max_tokens,
                'temperature': self.temperature
            }
        }
        
        async with aiohttp.ClientSession() as session:
            async with session.post(url, headers=headers, json=payload) as response:
                response.raise_for_status()
                data = await response.json()
        
        # Extract response data
        content = data['candidates'][0]['content']['parts'][0]['text']
        
        # Gemini provides token counts in usageMetadata
        usage_metadata = data.get('usageMetadata', {})
        prompt_tokens = usage_metadata.get('promptTokenCount', 0)
        completion_tokens = usage_metadata.get('candidatesTokenCount', 0)
        
        # Estimate cost
        cost_usd = self.estimate_cost(prompt_tokens, completion_tokens)
        
        return LLMResponse(
            content=content,
            prompt_tokens=prompt_tokens,
            completion_tokens=completion_tokens,
            model=self.model,
            cost_usd=cost_usd
        )
    
    def estimate_cost(self, prompt_tokens: int, completion_tokens: int) -> float:
        """
        Estimate cost in USD based on token usage.
        
        Args:
            prompt_tokens: Number of prompt tokens
            completion_tokens: Number of completion tokens
        
        Returns:
            Estimated cost in USD
        """
        prompt_cost = prompt_tokens / self.pricing['prompt_tokens_per_dollar']
        completion_cost = completion_tokens / self.pricing['completion_tokens_per_dollar']
        
        return prompt_cost + completion_cost
    
    def get_usage_stats(self) -> Dict[str, Any]:
        """
        Get cumulative usage statistics.
        
        Returns:
            Dictionary with usage statistics:
                - request_count: Total number of requests
                - total_prompt_tokens: Total prompt tokens used
                - total_completion_tokens: Total completion tokens used
                - total_tokens: Total tokens used
                - total_cost_usd: Total estimated cost in USD
        """
        return {
            'request_count': self.request_count,
            'total_prompt_tokens': self.total_prompt_tokens,
            'total_completion_tokens': self.total_completion_tokens,
            'total_tokens': self.total_prompt_tokens + self.total_completion_tokens,
            'total_cost_usd': self.total_cost_usd
        }
    
    def reset_usage_stats(self) -> None:
        """Reset usage statistics to zero."""
        self.total_prompt_tokens = 0
        self.total_completion_tokens = 0
        self.total_cost_usd = 0.0
        self.request_count = 0
        logger.info("Usage statistics reset")
